import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

export const BASE_URL = "http://localhost:3000";

export function extractCookies(res: Response): string {
  // get all set-cookie headers and join them for use as Cookie header
  const raw = res.headers.get("set-cookie") ?? "";
  // parse each cookie and extract name=value pairs
  return raw
    .split(/,(?=[^ ])/) // split on comma not followed by space
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

// update post to return all cookies:
export async function post(path: string, body: object, cookies = "") {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      "user-agent": "test-browser/1.0",
      "accept-language": "en-US",
      "accept-encoding": "gzip",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : {};

  return {
    res,
    data,
    status: res.status,
    cookies: extractCookies(res), // all cookies properly extracted
  };
}

export async function get(path: string, cookies = "") {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    redirect: "manual", // don't follow redirects
    headers: {
      "Content-Type": "application/json",
      "user-agent": "test-browser/1.0",           // fixed fingerprint
      "accept-language": "en-US",                  // fixed fingerprint
      "accept-encoding": "gzip",                   // fixed fingerprint
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });
  
  // handle redirects (middleware sends these for unauth)
  if (res.status === 307 || res.status === 308 || res.type === "opaqueredirect") {
    return { res, data: {}, status: 401 };
  }

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : {};

  return { res, data, status: res.status };
}

export async function del(path: string, cookies = "") {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "user-agent": "test-browser/1.0",           // fixed fingerprint
      "accept-language": "en-US",                  // fixed fingerprint
      "accept-encoding": "gzip",                   // fixed fingerprint
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });
  const data = await res.json();
  return { res, data, status: res.status };
}

export async function getOTP(email: string): Promise<string> {
  const raw = await redis.get(`pending:signup:${email}`);
  if (!raw) throw new Error(`No pending signup for ${email}`);
  const parsed = JSON.parse(raw);
  return parsed.otp;
}

export async function getResetToken(userId: string): Promise<string> {
  const keys = await redis.keys(`pwd-reset:${userId}:*`);
  if (!keys.length) throw new Error(`No reset token for ${userId}`);
  return keys[0].split(`pwd-reset:${userId}:`)[1];
}

export async function cleanUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.oAuthAccount.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await redis.del(`pending:signup:${email}`);
}

export async function flushRateLimits() {
  const keys = await redis.keys("rl:*");
  const lockouts = await redis.keys("lockout:*");
  const failed = await redis.keys("failed:*");
  const all = [...keys, ...lockouts, ...failed];
  if (all.length) await redis.del(...all);
}

// mock turnstile — bypass in test env
export const MOCK_TURNSTILE = "test-token-bypass";