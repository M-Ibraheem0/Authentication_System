import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";

// routes that don't need auth
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

// routes only for non-authenticated users
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

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  const accessToken = req.cookies.get("access_token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;
  const sessionId = req.cookies.get("session_id")?.value;

  // try to validate access token
  let isAuthenticated = false;
  let payload = null;

  if (accessToken) {
    payload = await verifyAccessToken(accessToken);
    if (payload) {
      isAuthenticated = true;
    }
  }

  // access token expired but refresh token exists — attempt silent refresh
  if (!isAuthenticated && refreshToken && sessionId) {
    const refreshResponse = await fetch(
      `${req.nextUrl.origin}/api/auth/refresh`,
      {
        method: "POST",
        headers: {
          cookie: req.headers.get("cookie") ?? "",
        },
      }
    );

    if (refreshResponse.ok) {
      isAuthenticated = true;

      // if trying to access auth route after refresh — redirect to dashboard
      if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
        const response = NextResponse.redirect(
          new URL("/dashboard", req.url)
        );
        // forward new cookies from refresh response
        refreshResponse.headers.getSetCookie().forEach((cookie) => {
          response.headers.append("set-cookie", cookie);
        });
        return response;
      }

      // forward new cookies on continued navigation
      const response = NextResponse.next();
      refreshResponse.headers.getSetCookie().forEach((cookie) => {
        response.headers.append("set-cookie", cookie);
      });
      return response;
    }
  }

  // authenticated user trying to access auth pages — redirect to dashboard
  if (isAuthenticated && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // unauthenticated user trying to access protected route
  if (!isAuthenticated && !isPublicRoute) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};