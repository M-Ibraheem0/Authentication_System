import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { slidingWindowRateLimit } from "@/lib/rate-limit";
import { createSession, setAuthCookies } from "@/lib/session";
import { getIP, getDeviceInfo } from "@/lib/fingerprint";

const verifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const deviceInfo = getDeviceInfo(req);

    const body = await req.json();

    // 1. validate schema
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, otp } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 2. rate limit — max 5 attempts per 10 min
    const rateLimit = await slidingWindowRateLimit(
      `rl:verify:${normalizedEmail}`,
      5,
      600
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Request a new code." },
        { status: 429 }
      );
    }

    // 3. get pending signup from redis
    const pendingRaw = await redis.get(`pending:signup:${normalizedEmail}`);
    if (!pendingRaw) {
      return NextResponse.json(
        { error: "Code expired. Please sign up again." },
        { status: 400 }
      );
    }

    const pending = JSON.parse(pendingRaw);

    // 4. check OTP attempt counter
    const attemptKey = `otp:attempts:${normalizedEmail}`;
    const attempts = await redis.incr(attemptKey);
    await redis.expire(attemptKey, 600);

    if (attempts > 3) {
      // too many wrong attempts — kill the pending signup
      await redis.del(`pending:signup:${normalizedEmail}`);
      await redis.del(attemptKey);
      return NextResponse.json(
        { error: "Too many wrong attempts. Please sign up again." },
        { status: 400 }
      );
    }

    // 5. compare OTP
    if (pending.otp !== otp) {
      return NextResponse.json(
        {
          error: "Invalid code",
          attemptsLeft: 3 - attempts,
        },
        { status: 400 }
      );
    }

    // 6. OTP valid — create user in postgres
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        hashedPassword: pending.hashedPassword,
        isVerified: true,
      },
      create: {
        email: normalizedEmail,
        hashedPassword: pending.hashedPassword,
        isVerified: true,
      },
    });

    // 7. cleanup redis
    await redis.del(`pending:signup:${normalizedEmail}`);
    await redis.del(attemptKey);

    // 8. create session
    const { sessionId, accessToken, refreshToken } = await createSession(
      user.id,
      deviceInfo,
      ip
    );

    // 9. set cookies
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
    console.error("[VERIFY EMAIL ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}