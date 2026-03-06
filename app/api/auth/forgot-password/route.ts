import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { generateResetToken, hashToken } from "@/lib/tokens";
import { verifyTurnstile } from "@/lib/turnstile";
import { getIP } from "@/lib/fingerprint";
import { slidingWindowRateLimit } from "@/lib/rate-limit";
import { sendEmailJob } from "@/lib/email/queue";

const forgotSchema = z.object({
  email: z.string().email("Invalid email"),
  turnstileToken: z.string().min(1, "Captcha required"),
});

const RESET_TTL = 900; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const body = await req.json();

    // 1. validate
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, turnstileToken } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 2. turnstile
    const turnstileValid = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileValid) {
      return NextResponse.json(
        { error: "Captcha verification failed" },
        { status: 400 }
      );
    }

    // 3. find user first to get userId for rate limiting
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isVerified: true },
    });

    // 4. rate limit by userId if exists, otherwise by IP
    // max 1 per week
    const rateLimitKey = user
      ? `rl:forgot:${user.id}`
      : `rl:forgot:ip:${ip}`;

    const rateLimit = await slidingWindowRateLimit(
      rateLimitKey,
      1,
      604800 // 1 per week
    );

    if (!rateLimit.allowed) {
      // still return 200 — no enumeration
      return NextResponse.json(
        { success: true, message: "If that email exists, a reset link has been sent." },
        { status: 200 }
      );
    }

    // 5. user not found or not verified — return 200 anyway (no enumeration)
    if (!user || !user.isVerified) {
      return NextResponse.json(
        { success: true, message: "If that email exists, a reset link has been sent." },
        { status: 200 }
      );
    }

    // 6. generate reset token
    const resetToken = generateResetToken();
    const hashedToken = hashToken(resetToken);

    // 7. store in redis
    await redis.set(
      `pwd-reset:${user.id}`,
      hashedToken,
      "EX",
      RESET_TTL
    );

    // 8. build reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}&userId=${user.id}`;

    // 9. queue email (deduplicated)
    const dedupeKey = `forgot-${user.id}-${Math.floor(Date.now() / 60000)}`;
    await sendEmailJob(
      {
        type: "forgot-password",
        to: normalizedEmail,
        resetUrl,
      },
      dedupeKey
    );

    return NextResponse.json(
      { success: true, message: "If that email exists, a reset link has been sent." },
      { status: 200 }
    );
  } catch (err) {
    console.error("[FORGOT PASSWORD ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}