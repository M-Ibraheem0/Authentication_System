import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";
import { prisma, db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { deleteSession } from "@/lib/session";

// GET — list all active sessions
export async function GET(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("access_token")?.value;
    const currentSessionId = req.cookies.get("session_id")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // get all sessions from postgres
    const sessions = await db(() => prisma.session.findMany({
      where: {
        userId: payload.userId,
        expiresAt: { gt: new Date() }, // only non-expired
      },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    }));

    // verify each session still exists in redis
    // postgres and redis can drift — redis is source of truth
    const activeSessions = await Promise.all(
      sessions.map(async (session) => {
        const redisSession = await redis.get(`session:${session.id}`);
        if (!redisSession) return null;

        return {
          ...session,
          isCurrent: session.id === currentSessionId,
        };
      })
    );

    // filter out sessions that expired in redis but not yet in postgres
    const validSessions = activeSessions.filter(Boolean);

    return NextResponse.json(
      { sessions: validSessions },
      { status: 200 }
    );
  } catch (err) {
    console.error("[SESSIONS GET ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// DELETE — revoke a specific session or all sessions
export async function DELETE(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("access_token")?.value;
    const currentSessionId = req.cookies.get("session_id")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const revokeAll = searchParams.get("all") === "true";

    if (revokeAll) {
      // revoke all sessions except current
      const sessions = await db(() => prisma.session.findMany({
        where: { userId: payload.userId },
        select: { id: true },
      }));

      const pipeline = redis.pipeline();
      sessions.forEach((s) => {
        if (s.id !== currentSessionId) {
          pipeline.del(`session:${s.id}`);
        }
      });
      await pipeline.exec();

      await db(() => prisma.session.deleteMany({
        where: {
          userId: payload.userId,
          id: { not: currentSessionId },
        },
      }));

      return NextResponse.json(
        { success: true, message: "All other sessions revoked" },
        { status: 200 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    // verify the session belongs to this user
    const session = await db(() => prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: payload.userId,
      },
    }));

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    await deleteSession(sessionId);

    return NextResponse.json(
      { success: true, message: "Session revoked" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[SESSIONS DELETE ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}