import { NextRequest, NextResponse } from "next/server";
import { Google } from "arctic";
import { prisma } from "@/lib/prisma";
import { createSession, setAuthCookies } from "@/lib/session";
import { getIP, getDeviceInfo } from "@/lib/fingerprint";

const google = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/google/callback`
);

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
    if (
      !code ||
      !state ||
      !storedState ||
      !codeVerifier ||
      state !== storedState
    ) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
      );
    }

    // 2. exchange code for tokens
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const accessToken = tokens.accessToken();

    // 3. fetch google user profile
    const googleRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const googleUser: GoogleUser = await googleRes.json();

    if (!googleUser.email_verified) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=email_not_verified`
      );
    }

    // 4. check if oauth account exists
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: googleUser.sub,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      // user exists, just sign in
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
    const existingUser = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    let userId: string;

    if (existingUser) {
      // link google to existing account
      await prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: "google",
          providerAccountId: googleUser.sub,
        },
      });
      userId = existingUser.id;
    } else {
      // create brand new user
      const newUser = await prisma.user.create({
        data: {
          email: googleUser.email,
          isVerified: true, // google already verified the email
          oauthAccount: {
            create: {
              provider: "google",
              providerAccountId: googleUser.sub,
            },
          },
        },
      });
      userId = newUser.id;
    }

    // 6. create session
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