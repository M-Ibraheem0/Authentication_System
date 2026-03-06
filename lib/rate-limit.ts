import { redis } from "./redis";

export async function slidingWindowRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const requestId = `${now}-${Math.random()}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, requestId);
  pipeline.zcard(key);
  pipeline.expire(key, windowSeconds);

  const results = await pipeline.exec();
  const count = results![2][1] as number;

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfter: count > limit ? windowSeconds : undefined,
  };
}

export async function getSuspicionScore(
  fingerprint: string,
  ip: string,
  email: string,
  formFillTime?: number
): Promise<number> {
  let score = 0;
  if (formFillTime && formFillTime < 3000) score += 3;
  const ipCount = await redis.zcard(`rl:signup:${ip}`);
  if (ipCount > 10) score += 1;
  if (ipCount > 20) score += 2;
  const botEmailPatterns = [
    /[a-z]{8,}\d{4,}@/,
    /\d{6,}@/,
    /(.)\1{4,}/,
  ];
  if (botEmailPatterns.some((p) => p.test(email))) score += 2;
  const uniqueEmailsKey = `hll:signup:emails:${ip}`;
  await redis.pfadd(uniqueEmailsKey, email);
  await redis.expire(uniqueEmailsKey, 3600);
  const uniqueEmails = await redis.pfcount(uniqueEmailsKey);
  if (uniqueEmails > 20) score += 4;
  const fingerprintCount = await redis.get(`rl:signup:fp:${fingerprint}`);
  if (fingerprintCount && parseInt(fingerprintCount) > 3) score += 2;

  return score;
}

export async function getTarpit(score: number): Promise<number> {
  // returns delay in milliseconds
  if (score <= 2) return 0;
  if (score <= 4) return 0;       // just captcha, no delay
  if (score <= 6) return 10_000;  // 10 seconds
  return 30_000;                  // 30 seconds
}

export async function incrementFingerprintCount(
  fingerprint: string
): Promise<void> {
  const key = `rl:signup:fp:${fingerprint}`;
  await redis.incr(key);
  await redis.expire(key, 3600);
}

export async function isLockedOut(ip: string): Promise<boolean> {
  const locked = await redis.get(`lockout:${ip}`);
  return locked !== null;
}

export async function incrementFailedAttempts(ip: string): Promise<number> {
  const key = `failed:signin:${ip}`;
  const count = await redis.incr(key);
  await redis.expire(key, 900); 
  if (count >= 5) {
    await redis.set(`lockout:${ip}`, "1", "EX", 900);
  }
  return count;
}