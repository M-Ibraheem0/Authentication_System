// app/api/auth/oauth/github/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, db } from "@/lib/prisma";
import { createSession, setAuthCookies } from "@/lib/session";
import { getIP, getDeviceInfo } from "@/lib/fingerprint";
import { signTempToken } from "@/lib/tokens-server";

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getIP(req);
    const deviceInfo = getDeviceInfo(req);

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = req.cookies.get("github_oauth_state")?.value;

    // 1. validate state
    if (!code || !state || !storedState || state !== storedState) {
      console.error("[GITHUB CALLBACK] State validation failed");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
      );
    }

    console.log("[GITHUB CALLBACK] State validation passed, exchanging code...");

    // 2. manual token exchange — bypass Arctic to avoid IPv6 issues
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/github/callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[GITHUB TOKEN ERROR]", await tokenRes.text());
      throw new Error("Token exchange failed");
    }

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("[GITHUB TOKEN ERROR]", tokenData.error_description);
      throw new Error(tokenData.error);
    }

    const accessToken = tokenData.access_token;

    // 3. fetch github user
    const githubRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!githubRes.ok) {
      throw new Error("Failed to fetch GitHub user");
    }

    const githubUser: GitHubUser = await githubRes.json();

    // 4. github sometimes hides email — fetch from emails endpoint
    let email = githubUser.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      const emails: GitHubEmail[] = await emailsRes.json();
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      email = primaryEmail?.email ?? null;
    }

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=no_email`
      );
    }

    // 5. check if oauth account exists
    const existingOAuth = await db(() =>
      prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "github",
            providerAccountId: String(githubUser.id),
          },
        },
        include: { user: true },
      })
    );

    if (existingOAuth) {
      // MFA check
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

    // 6. check if email exists as password user
    const existingUser = await db(() =>
      prisma.user.findUnique({ where: { email: email! } })
    );

    let userId: string;

    if (existingUser) {
      await db(() =>
        prisma.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: "github",
            providerAccountId: String(githubUser.id),
          },
        })
      );
      userId = existingUser.id;
    } else {
      const newUser = await db(() =>
        prisma.user.create({
          data: {
            email: email!,
            isVerified: true,
            oauthAccount: {
              create: {
                provider: "github",
                providerAccountId: String(githubUser.id),
              },
            },
          },
        })
      );
      userId = newUser.id;
    }

    // 7. MFA check for linked/new users
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

    // 8. create session
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
    console.error("[GITHUB CALLBACK ERROR]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
    );
  }
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete("github_oauth_state");
}