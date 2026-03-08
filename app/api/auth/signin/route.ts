import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, db } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { verifyTurnstile } from "@/lib/turnstile";
import { getFingerprint, getIP, getDeviceInfo } from "@/lib/fingerprint";
import {
  slidingWindowRateLimit,
  isLockedOut,
  incrementFailedAttempts,
} from "@/lib/rate-limit";
import { createSession, setAuthCookies } from "@/lib/session";
import { signTempToken } from "@/lib/tokens-server";

const signinSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
  turnstileToken: z.string().min(1, "Captcha required"),
  honeypot: z.string().optional(),
  formFillTime: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const fingerprint = getFingerprint(req);
    const deviceInfo = getDeviceInfo(req);

    const body = await req.json();

    // 1. honeypot
    if (body.honeypot && body.honeypot !== "") {
      // silent 200 — don't tell bots they failed
      return NextResponse.json({ success: true });
    }
    if (body.formFillTime && body.formFillTime < 1500) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 2. validate schema
    const parsed = signinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, turnstileToken, formFillTime } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 3. turnstile verify
    const turnstileValid = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileValid) {
      return NextResponse.json(
        { error: "Captcha verification failed" },
        { status: 400 }
      );
    }
    // 5. tarpit suspicious requests
    if (formFillTime && formFillTime < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }

    // 6. lockout check
    const locked = await isLockedOut(ip);
    if (locked) {
      return NextResponse.json(
        { error: "Account temporarily locked. Try again in 15 minutes." },
        { status: 423 }
      );
    }

    // 7. find user
    // intentionally same error for wrong email or wrong password
    const user = await db(() => prisma.user.findUnique({
      where: { email: normalizedEmail },
    }));

    if (!user || !user.hashedPassword) {
      await incrementFailedAttempts(ip);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 8. verify password
    const passwordValid = await verifyPassword(password, user.hashedPassword);
    if (!passwordValid) {
      await incrementFailedAttempts(ip);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 9. check verified
    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Please verify your email first" },
        { status: 403 }
      );
    }

    // 10. MFA check
    if (user.mfaEnabled) {
      const tempToken = await signTempToken({
        userId: user.id,
        purpose: "mfa",
      });

      return NextResponse.json(
        { requiresMfa: true, tempToken },
        { status: 200 }
      );
    }

    // 11. create session
    const { sessionId, accessToken, refreshToken } = await createSession(
      user.id,
      deviceInfo,
      ip
    );

    const response = NextResponse.json(
      {
        success: true,
        user: { id: user.id, email: user.email },
      },
      { status: 200 }
    );

    setAuthCookies(response, accessToken, refreshToken, sessionId);

    return response;
  } catch (err) {
    console.error("[SIGNIN ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}