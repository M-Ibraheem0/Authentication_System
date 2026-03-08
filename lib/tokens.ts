import { jwtVerify } from "jose";

export interface JWTPayload {
  userId: string;
  sessionId: string;
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function verifyAccessToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyTempToken(token: string): Promise<{
  userId: string;
  purpose: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as { userId: string; purpose: string };
  } catch {
    return null;
  }
}