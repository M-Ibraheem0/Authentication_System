import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken, JWTPayload } from "./tokens";
import { prisma, db } from "@/lib/prisma";

// use in route handlers (has access to req)
export async function getAuthFromRequest(
  req: NextRequest
): Promise<JWTPayload | null> {
  const accessToken = req.cookies.get("access_token")?.value;
  if (!accessToken) return null;
  return verifyAccessToken(accessToken);
}

// use in server components and server actions
export async function getAuth(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  if (!accessToken) return null;
  return verifyAccessToken(accessToken);
}

// use when you need full user object
export async function getCurrentUser() {
  const payload = await getAuth();
  if (!payload) return null;

  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      isVerified: true,
      mfaEnabled: true,
      createdAt: true,
    },
  });
}