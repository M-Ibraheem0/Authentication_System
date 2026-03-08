import { NextRequest, NextResponse } from "next/server";
import { GitHub } from "arctic";
import { prisma, db } from "@/lib/prisma";import { createSession, setAuthCookies } from "@/lib/session";
import { getIP, getDeviceInfo } from "@/lib/fingerprint";

const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/github/callback`
);

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
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
      );
    }

    // 2. exchange code for token
    const tokens = await github.validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();

    // 3. fetch github user
    const githubRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
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
    const existingOAuth = await db(() => prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "github",
          providerAccountId: String(githubUser.id),
        },
      },
      include: { user: true },
    }));

    if (existingOAuth) {
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
    const existingUser = await db(() => prisma.user.findUnique({
      where: { email },
    }));

    let userId: string;

    if (existingUser) {
      // link github to existing account
      await db(() =>prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: "github",
          providerAccountId: String(githubUser.id),
        },
      }));
      userId = existingUser.id;
    } else {
      // create new user
      const newUser = await db(() => prisma.user.create({
        data: {
          email,
          isVerified: true,
          oauthAccount: {
            create: {
              provider: "github",
              providerAccountId: String(githubUser.id),
            },
          },
        },
      }));
      userId = newUser.id;
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
    console.error("[GITHUB CALLBACK ERROR]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
    );
  }
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete("github_oauth_state");
}