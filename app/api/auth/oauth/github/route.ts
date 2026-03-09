// app/api/auth/oauth/github/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GitHub } from "arctic";
import crypto from "crypto";

const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/github/callback`
);

export async function GET(req: NextRequest) {
  try {
    const state = crypto.randomUUID();
    const url = github.createAuthorizationURL(state, ["user:email"]);

    // force account picker on every sign in
    url.searchParams.set("login", "");

    const response = NextResponse.redirect(url);
    response.cookies.set("github_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[GITHUB OAUTH ERROR]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
    );
  }
}