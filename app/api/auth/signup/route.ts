import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { hashPassword, checkPasswordStrength } from "@/lib/password";
import { generateOTP } from "@/lib/tokens-server";
import { verifyTurnstile } from "@/lib/turnstile";
import { getFingerprint, getIP } from "@/lib/fingerprint";
import {
  slidingWindowRateLimit,
  getSuspicionScore,
  getTarpit,
  incrementFingerprintCount,
} from "@/lib/rate-limit";
import { sendEmailJob } from "@/lib/email/queue";

const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password too short"),
  turnstileToken: z.string().min(1, "Captcha required"),
  honeypot: z.string().optional(),
  formFillTime: z.number().optional(),
});

const PENDING_TTL = 600; // 10 minutes

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const fingerprint = getFingerprint(req);

    // 1. parse body
    const body = await req.json();

    // 2. honeypot check
    if (body.honeypot && body.honeypot !== "") {
      // silent 200 — don't tell bots they failed
      return NextResponse.json({ success: true });
    }
    if (body.formFillTime && body.formFillTime < 1500) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    // 3. validate schema
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, turnstileToken, formFillTime } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 4. turnstile verify
    const turnstileValid = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileValid) {
      return NextResponse.json(
        { error: "Captcha verification failed" },
        { status: 400 }
      );
    }

    

    // 6. suspicion score + tarpit
    const score = await getSuspicionScore(
      fingerprint,
      ip,
      normalizedEmail,
      formFillTime
    );

    await incrementFingerprintCount(fingerprint);

    const delay = await getTarpit(score);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // 7. password strength check
    const strengthCheck = checkPasswordStrength(password);
    if (!strengthCheck.valid) {
      return NextResponse.json(
        { error: strengthCheck.message },
        { status: 400 }
      );
    }

    // 8. check if verified user already exists in postgres
    const existingUser = await db(() => prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { isVerified: true },
    }));

    if (existingUser?.isVerified) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    // 9. hash password
    const hashedPassword = await hashPassword(password);

    // 10. generate OTP
    const otp = generateOTP();

    // 11. store in redis (overwrite if exists — user resending)
    await redis.set(
      `pending:signup:${normalizedEmail}`,
      JSON.stringify({
        hashedPassword,
        otp,
        createdAt: new Date().toISOString(),
      }),
      "EX",
      PENDING_TTL
    );

    // 12. queue email (deduplicated — one per minute)
    const dedupeKey = `signup-${normalizedEmail}-${Math.floor(Date.now() / 60000)}`;
    await sendEmailJob(
      {
        type: "verify-email",
        to: normalizedEmail,
        otp,
      },
      dedupeKey
    );

    return NextResponse.json(
      { success: true, message: "Check your email for the verification code" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[SIGNUP ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}