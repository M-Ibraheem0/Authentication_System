import { redis } from "./redis";
import { prisma, db } from "@/lib/prisma";
import { generateRefreshToken, hashToken, signAccessToken } from "./tokens";
import { NextResponse } from "next/server";
import crypto from "crypto";

const SESSION_TTL = 60 * 60 * 24 * 30; 
const ACCESS_TOKEN_MAX_AGE = 60 * 15;   
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; 

export async function createSession(
  userId: string,
  deviceInfo: string,
  ipAddress: string
) {
  const sessionId = crypto.randomUUID();
  const refreshToken = generateRefreshToken();
  const hashedRefreshToken = hashToken(refreshToken);
  const accessToken = await signAccessToken({ userId, sessionId });

  // store in Redis
  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({
      userId,
      hashedRefreshToken,
      deviceInfo,
      ipAddress,
      createdAt: new Date().toISOString(),
    }),
    "EX",
    SESSION_TTL
  );

  // store in Postgres (for session management UI)
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      hashedRefreshToken,
      deviceInfo,
      ipAddress,
      expiresAt: new Date(Date.now() + SESSION_TTL * 1000),
    },
  });

  return { sessionId, accessToken, refreshToken };
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  sessionId: string
) {
  response.cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
  });

  response.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
  });

  response.cookies.set("session_id", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  response.cookies.delete("session_id");
}

export async function deleteSession(sessionId: string) {
  await redis.del(`session:${sessionId}`);
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function deleteAllUserSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId },
    select: { id: true },
  });

  const pipeline = redis.pipeline();
  sessions.forEach((s) => pipeline.del(`session:${s.id}`));
  await pipeline.exec();

  await prisma.session.deleteMany({ where: { userId } });
}