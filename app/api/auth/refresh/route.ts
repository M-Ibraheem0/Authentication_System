import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { hashToken, signAccessToken, generateRefreshToken } from "@/lib/tokens-server";
import { setAuthCookies } from "@/lib/session";
import { prisma, db } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("refresh_token")?.value;
    const sessionId = req.cookies.get("session_id")?.value;

    if (!refreshToken || !sessionId) {
      return NextResponse.json(
        { error: "No session found" },
        { status: 401 }
      );
    }

    // 1. get session from redis
    const sessionRaw = await redis.get(`session:${sessionId}`);
    if (!sessionRaw) {
      return NextResponse.json(
        { error: "Session expired" },
        { status: 401 }
      );
    }

    const session = JSON.parse(sessionRaw);

    // 2. hash incoming refresh token and compare
    const hashedIncoming = hashToken(refreshToken);
    if (hashedIncoming !== session.hashedRefreshToken) {
      // token mismatch = possible theft
      // kill the entire session immediately
      await redis.del(`session:${sessionId}`);
      await db(() => prisma.session.deleteMany({ where: { id: sessionId } }));

      return NextResponse.json(
        { error: "Session invalid" },
        { status: 401 }
      );
    }

    // 3. rotate — generate new tokens
    const newRefreshToken = generateRefreshToken();
    const newHashedRefreshToken = hashToken(newRefreshToken);
    const newAccessToken = await signAccessToken({
      userId: session.userId,
      sessionId,
    });

    // 4. update session in redis with new hashed refresh token
    const ttl = await redis.ttl(`session:${sessionId}`);
    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        ...session,
        hashedRefreshToken: newHashedRefreshToken,
      }),
      "EX",
      ttl > 0 ? ttl : 60 * 60 * 24 * 30
    );

    // 5. update in postgres
    await db(() => prisma.session.update({
      where: { id: sessionId },
      data: { hashedRefreshToken: newHashedRefreshToken },
    }));

    // 6. set new cookies
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    setAuthCookies(response, newAccessToken, newRefreshToken, sessionId);

    return response;
  } catch (err) {
    console.error("[REFRESH ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}