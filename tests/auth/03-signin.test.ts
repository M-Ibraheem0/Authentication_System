import { post, cleanUser, flushRateLimits, getOTP, MOCK_TURNSTILE } from "../helpers";
import { redis } from "@/lib/redis";
import {beforeEach, describe, expect, it, beforeAll} from '@jest/globals'

const TEST_EMAIL = "test-signin@example.com";
const TEST_PASSWORD = "TestPass123!";

async function createVerifiedUser() {
  await post("/api/auth/signup", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    turnstileToken: MOCK_TURNSTILE,
    honeypot: "",
    formFillTime: 5000,
  });
  const otp = await getOTP(TEST_EMAIL);
  await post("/api/auth/verify-email", { email: TEST_EMAIL, otp });
}

beforeAll(async () => {
  await cleanUser(TEST_EMAIL);
  await flushRateLimits();
  await createVerifiedUser();
});

beforeEach(async () => {
  await flushRateLimits();
});

describe("POST /api/auth/signin", () => {

  it("✅ signs in and returns tokens in cookies", async () => {
    const { status, data, cookies } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(200);
    expect(cookies).toContain("access_token");
    expect(cookies).toContain("refresh_token");
  });

  it("✅ session stored in Redis", async () => {
    const { data, cookies } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    const sessionKeys = await redis.keys("session:*");
    expect(sessionKeys.length).toBeGreaterThan(0);
  });

  it("❌ rejects wrong password — generic error", async () => {
    const { status, data } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: "WrongPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(401);
    // must be generic — no "wrong password" hint
    expect(data.error).not.toMatch(/password/i);
    expect(data.error).not.toMatch(/email/i);
  });

  it("❌ rejects non-existent email — same generic error", async () => {
    const { status, data } = await post("/api/auth/signin", {
      email: "ghost@example.com",
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(401);
    expect(data.error).not.toMatch(/password/i);
    expect(data.error).not.toMatch(/email/i);
  });

  it("❌ lockout after 5 failed attempts", async () => {
    for (let i = 0; i < 5; i++) {
      await post("/api/auth/signin", {
        email: TEST_EMAIL,
        password: "WrongPass123!",
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "",
        formFillTime: 5000,
      });
    }
    const { status } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(423); // locked
  });

  it("❌ rejects honeypot", async () => {
    const { status, data } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "bot",
      formFillTime: 5000,
    });
    // silent 200 — don't reveal to bots
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("❌ sliding window rate limit (10 per 15min)", async () => {
    await flushRateLimits();
    const ts = Date.now();
    // use emails that don't exist — no lockout triggered
    for (let i = 0; i < 11; i++) {
      await post("/api/auth/signin", {
        email: `nouser${ts}${i}@example.com`,
        password: "WrongPass123!",
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "",
        formFillTime: 5000,
      });
    }
    const { status } = await post("/api/auth/signin", {
      email: `nouser${ts}12@example.com`,
      password: "WrongPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
  expect(status).toBe(429);
  });

});