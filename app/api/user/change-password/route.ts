import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/auth";
import { prisma, db } from "@/lib/prisma";
import { verifyPassword, hashPassword, checkPasswordStrength } from "@/lib/password";
import { deleteAllUserSessions } from "@/lib/session";
import { slidingWindowRateLimit } from "@/lib/rate-limit";
import { getIP } from "@/lib/fingerprint";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "Password too short"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const payload = await getAuthFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // rate limit
    const rateLimit = await slidingWindowRateLimit(
      `rl:change-password:${payload.userId}`,
      5,
      3600
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    // get user
    const user = await db(() =>
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { hashedPassword: true },
      })
    );

    if (!user?.hashedPassword) {
      return NextResponse.json(
        { error: "No password set. Use OAuth to sign in." },
        { status: 400 }
      );
    }

    // verify current password
    const valid = await verifyPassword(currentPassword, user.hashedPassword);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // check new password strength
    const strengthCheck = checkPasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return NextResponse.json(
        { error: strengthCheck.message },
        { status: 400 }
      );
    }

    // hash and update
    const hashedPassword = await hashPassword(newPassword);
    await db(() =>
      prisma.user.update({
        where: { id: payload.userId },
        data: { hashedPassword },
      })
    );

    // kill all OTHER sessions — keep current one
    const currentSessionId = req.cookies.get("session_id")?.value;
    if (currentSessionId) {
      const allSessions = await db(() =>
        prisma.session.findMany({
          where: { userId: payload.userId },
          select: { id: true },
        })
      );

      for (const session of allSessions) {
        if (session.id !== currentSessionId) {
          await deleteAllUserSessions(payload.userId);
          break;
        }
      }
    }

    return NextResponse.json(
      { success: true, message: "Password updated successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[CHANGE PASSWORD ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}