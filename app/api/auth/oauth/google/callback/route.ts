import { NextRequest, NextResponse } from "next/server";
import { prisma, db } from "@/lib/prisma";
import { createSession, setAuthCookies } from "@/lib/session";
import { getIP, getDeviceInfo } from "@/lib/fingerprint";
import { signTempToken } from "@/lib/tokens-server";

interface GoogleUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getIP(req);
    const deviceInfo = getDeviceInfo(req);

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    const storedState = req.cookies.get("google_oauth_state")?.value;
    const codeVerifier = req.cookies.get("google_code_verifier")?.value;

    // 1. validate state + verifier
    if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
      console.error("[GOOGLE CALLBACK] State validation failed", {
        code: !!code,
        state: !!state,
        storedState: !!storedState,
        codeVerifier: !!codeVerifier,
        stateMatch: state === storedState,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
      );
    }

    console.log("[GOOGLE CALLBACK] State validation passed, exchanging code...");

    // 2. exchange code for tokens (manual fetch — bypass Arctic to avoid IPv6 issues)
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/google/callback`,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[GOOGLE TOKEN ERROR]", err);
      throw new Error("Token exchange failed");
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 3. fetch google user profile
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!googleRes.ok) {
      console.error("[GOOGLE USERINFO ERROR]", await googleRes.text());
      throw new Error("Failed to fetch user info");
    }

    const googleUser: GoogleUser = await googleRes.json();

    if (!googleUser.email_verified) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=email_not_verified`
      );
    }

    // 4. check if oauth account exists
    const existingOAuth = await db(() =>
      prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: googleUser.sub,
          },
        },
        include: { user: true },
      })
    );

    if (existingOAuth) {
      // check MFA before creating session
      if (existingOAuth.user.mfaEnabled) {
        const tempToken = await signTempToken({
          userId: existingOAuth.user.id,
          purpose: "mfa",
        });
        const response = NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/auth/mfa?tempToken=${tempToken}`
        );
        clearOAuthCookies(response);
        return response;
      }

      // no MFA — create session directly
      const { sessionId, accessToken: jwt, refreshToken } = await createSession(
        existingOAuth.user.id,
        deviceInfo,
        ip
      );
      const response = NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      );
      setAuthCookies(response, jwt, refreshToken, sessionId);
      clearOAuthCookies(response);
      return response;
    }

    // 5. check if email already exists as password user
    const existingUser = await db(() =>
      prisma.user.findUnique({
        where: { email: googleUser.email },
      })
    );

    let userId: string;

    if (existingUser) {
      // link google to existing password account
      await db(() =>
        prisma.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: "google",
            providerAccountId: googleUser.sub,
          },
        })
      );
      userId = existingUser.id;
    } else {
      // create brand new user
      const newUser = await db(() =>
        prisma.user.create({
          data: {
            email: googleUser.email,
            isVerified: true,
            oauthAccount: {
              create: {
                provider: "google",
                providerAccountId: googleUser.sub,
              },
            },
          },
        })
      );
      userId = newUser.id;
    }

    // 6. check MFA for existing password user who just linked Google
    const userForMfa = await db(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: { mfaEnabled: true },
      })
    );

    if (userForMfa?.mfaEnabled) {
      const tempToken = await signTempToken({ userId, purpose: "mfa" });
      const response = NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/mfa?tempToken=${tempToken}`
      );
      clearOAuthCookies(response);
      return response;
    }

    // 7. create session
    const { sessionId, accessToken: jwt, refreshToken } = await createSession(
      userId,
      deviceInfo,
      ip
    );

    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );
    setAuthCookies(response, jwt, refreshToken, sessionId);
    clearOAuthCookies(response);
    return response;
  } catch (err) {
    console.error("[GOOGLE CALLBACK ERROR]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
    );
  }
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete("google_oauth_state");
  response.cookies.delete("google_code_verifier");
}