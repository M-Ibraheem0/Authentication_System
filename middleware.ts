import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";

const PUBLIC_ROUTES = [
  "/",
  "/auth/signin",
  "/auth/signup",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/mfa",
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/verify-email",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/auth/oauth/google",
  "/api/auth/oauth/google/callback",
  "/api/auth/oauth/github",
  "/api/auth/oauth/github/callback",
  "/api/auth/mfa/verify",
];

const AUTH_ROUTES = [
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // CRITICAL: never run refresh logic on API routes to prevent loops
  if (pathname.startsWith("/api/")) {
    const isPublicApi = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );
    if (isPublicApi) return NextResponse.next();

    // protected API — just check access token, no refresh attempt
    const accessToken = req.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  const accessToken = req.cookies.get("access_token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;
  const sessionId = req.cookies.get("session_id")?.value;

  let isAuthenticated = false;

  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) isAuthenticated = true;
  }

  // only attempt refresh on page navigations, not API calls
  if (!isAuthenticated && refreshToken && sessionId) {
    try {
      const refreshResponse = await fetch(
        `${req.nextUrl.origin}/api/auth/refresh`,
        {
          method: "POST",
          headers: { cookie: req.headers.get("cookie") ?? "" },
        }
      );

      if (refreshResponse.ok) {
        isAuthenticated = true;

        if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
          const response = NextResponse.redirect(new URL("/dashboard", req.url));
          refreshResponse.headers.getSetCookie().forEach((cookie) => {
            response.headers.append("set-cookie", cookie);
          });
          return response;
        }

        const response = NextResponse.next();
        refreshResponse.headers.getSetCookie().forEach((cookie) => {
          response.headers.append("set-cookie", cookie);
        });
        return response;
      }

      // refresh failed — clear cookies to prevent further loop attempts
      if (refreshResponse.status === 401) {
        const response = NextResponse.redirect(
          new URL("/auth/signin", req.url)
        );
        response.cookies.delete("access_token");
        response.cookies.delete("refresh_token");
        response.cookies.delete("session_id");
        return response;
      }
    } catch {
      // fetch failed — fall through
    }
  }

  if (isAuthenticated && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!isAuthenticated && !isPublicRoute) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};