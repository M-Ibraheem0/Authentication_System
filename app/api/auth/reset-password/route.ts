import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { hashToken } from "@/lib/tokens";
import { hashPassword, checkPasswordStrength } from "@/lib/password";
import { deleteAllUserSessions } from "@/lib/session";
import { slidingWindowRateLimit } from "@/lib/rate-limit";
import { getIP } from "@/lib/fingerprint";

const resetSchema = z.object({
  token: z.string().min(1, "Token required"),
  userId: z.string().min(1, "User ID required"),
  newPassword: z.string().min(8, "Password too short"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const body = await req.json();

    // 1. validate
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { token, userId, newPassword } = parsed.data;

    // 2. rate limit — max 5 attempts per hour per IP
    const rateLimit = await slidingWindowRateLimit(
      `rl:reset:${ip}`,
      5,
      3600
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    // 3. get stored hash from redis
    const storedHash = await redis.get(`pwd-reset:${userId}`);
    if (!storedHash) {
      return NextResponse.json(
        { error: "Reset link expired or already used." },
        { status: 400 }
      );
    }

    // 4. hash incoming token and compare
    const incomingHash = hashToken(token);
    if (incomingHash !== storedHash) {
      return NextResponse.json(
        { error: "Invalid reset link." },
        { status: 400 }
      );
    }

    // 5. password strength check
    const strengthCheck = checkPasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return NextResponse.json(
        { error: strengthCheck.message },
        { status: 400 }
      );
    }

    // 6. delete token from redis immediately (one time use)
    await redis.del(`pwd-reset:${userId}`);

    // 7. hash new password
    const hashedPassword = await hashPassword(newPassword);

    // 8. update postgres
    await prisma.user.update({
      where: { id: userId },
      data: { hashedPassword },
    });

    // 9. kill ALL sessions — someone had the password
    await deleteAllUserSessions(userId);

    return NextResponse.json(
      { success: true, message: "Password reset successfully. Please sign in." },
      { status: 200 }
    );
  } catch (err) {
    console.error("[RESET PASSWORD ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}