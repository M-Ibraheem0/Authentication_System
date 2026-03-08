import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, db } from "@/lib/prisma";import { verifyTempToken } from "@/lib/tokens";
import { createSession, setAuthCookies } from "@/lib/session";
import { getIP, getDeviceInfo } from "@/lib/fingerprint";
import { slidingWindowRateLimit, isLockedOut, incrementFailedAttempts } from "@/lib/rate-limit";
import speakeasy from "speakeasy";
const mfaVerifySchema = z.object({
  tempToken: z.string().min(1, "Token required"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const deviceInfo = getDeviceInfo(req);

    const body = await req.json();
    // 1. rate limit
    const rateLimit = await slidingWindowRateLimit(
      `rl:mfa:${ip}`,
      5,
      300 // 5 attempts per 5 min
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }
    // 2. validate schema
    const parsed = mfaVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tempToken, code } = parsed.data;

    
    

    // 3. lockout check
    const locked = await isLockedOut(ip);
    if (locked) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again in 15 minutes." },
        { status: 423 }
      );
    }

    // 4. verify temp token
    const payload = await verifyTempToken(tempToken);
    if (!payload || payload.purpose !== "mfa") {
      return NextResponse.json(
        { error: "Invalid or expired session. Please sign in again." },
        { status: 401 }
      );
    }

    // 5. get user with mfa secret
    const user = await db(() => prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        mfaEnabled: true,
        mfaSecret: true,
      },
    }));

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        { error: "MFA not configured" },
        { status: 400 }
      );
    }
    // 6. verify TOTP code
    const isValid = speakeasy.totp.verify({
      token: code,
      secret: user.mfaSecret,
      encoding: 'base32',  // critical
      window: 1,           // allows 30s clock drift between server and phone
    });

    if (!isValid) {
      await incrementFailedAttempts(ip);
      return NextResponse.json(
        { error: "Invalid code" },
        { status: 401 }
      );
    }

    // 7. create full session
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
    console.error("[MFA VERIFY ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}