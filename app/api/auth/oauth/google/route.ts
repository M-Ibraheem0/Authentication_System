import { NextRequest, NextResponse } from "next/server";
import { Google } from "arctic";
import crypto from "crypto";

const google = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/google/callback`
);

export async function GET(req: NextRequest) {
  try {
    const state = crypto.randomUUID();
    const codeVerifier = crypto.randomUUID();

    const url = google.createAuthorizationURL(state, codeVerifier, [
      "openid",
      "email",
      "profile",
    ]);

    url.searchParams.set("prompt", "select_account"); // ← add this
    const response = NextResponse.redirect(url);
    // store state + codeVerifier in cookies for callback verification
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // lax required for oauth redirects
      maxAge: 60 * 10, // 10 min
      path: "/",
    });

    response.cookies.set("google_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[GOOGLE OAUTH ERROR]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=oauth_failed`
    );
  }
}