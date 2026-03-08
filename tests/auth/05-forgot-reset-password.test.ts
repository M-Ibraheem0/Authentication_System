import { post, getOTP, cleanUser, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import {beforeEach, describe, expect, it, beforeAll} from '@jest/globals'

const TEST_EMAIL = "test-forgot@example.com";
const TEST_PASSWORD = "TestPass123!";
const NEW_PASSWORD = "NewPass456!";

beforeAll(async () => {
  await cleanUser(TEST_EMAIL);
  await flushRateLimits();

  await post("/api/auth/signup", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    turnstileToken: MOCK_TURNSTILE,
    honeypot: "",
    formFillTime: 5000,
  });
  const otp = await getOTP(TEST_EMAIL);
  await post("/api/auth/verify-email", { email: TEST_EMAIL, otp });
});

describe("POST /api/auth/forgot-password", () => {

  beforeEach(async () => {
    await flushRateLimits();
  });

  it("✅ returns 200 even for non-existent email (no enumeration)", async () => {
    const { status } = await post("/api/auth/forgot-password", {
      email: "ghost@example.com",
    });
    expect(status).toBe(200);
  });

  it("✅ stores reset token in Redis", async () => {
    await post("/api/auth/forgot-password", { email: TEST_EMAIL });
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    const keys = await redis.keys(`pwd-reset:${user!.id}:*`);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("❌ rate limits to 1 per week per user", async () => {
    await post("/api/auth/forgot-password", { email: TEST_EMAIL });
    const { status } = await post("/api/auth/forgot-password", {
      email: TEST_EMAIL,
    });
    expect(status).toBe(429);
  });

});

describe("POST /api/auth/reset-password", () => {

  let resetToken = "";

  beforeEach(async () => {
    await flushRateLimits();
    await post("/api/auth/forgot-password", { email: TEST_EMAIL });
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    const keys = await redis.keys(`pwd-reset:${user!.id}:*`);
    resetToken = keys[0].split(`pwd-reset:${user!.id}:`)[1];
  });

  it("✅ resets password successfully", async () => {
    const { status } = await post("/api/auth/reset-password", {
      token: resetToken,
      password: NEW_PASSWORD,
    });
    expect(status).toBe(200);
  });

  it("✅ can sign in with new password", async () => {
    await post("/api/auth/reset-password", {
      token: resetToken,
      password: NEW_PASSWORD,
    });
    const { status } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: NEW_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(200);
  });

  it("✅ kills all sessions after reset", async () => {
    await post("/api/auth/reset-password", {
      token: resetToken,
      password: NEW_PASSWORD,
    });
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    const sessions = await prisma.session.findMany({
      where: { userId: user!.id },
    });
    expect(sessions.length).toBe(0);
  });

  it("❌ rejects invalid token", async () => {
    const { status } = await post("/api/auth/reset-password", {
      token: "fake-token",
      password: NEW_PASSWORD,
    });
    expect(status).toBe(400);
  });

  it("❌ rejects reused token", async () => {
    await post("/api/auth/reset-password", {
      token: resetToken,
      password: NEW_PASSWORD,
    });
    const { status } = await post("/api/auth/reset-password", {
      token: resetToken,
      password: "AnotherPass789!",
    });
    expect(status).toBe(400);
  });

  it("❌ rate limits (5 per hour)", async () => {
    for (let i = 0; i < 5; i++) {
      await post("/api/auth/reset-password", {
        token: "fake",
        password: NEW_PASSWORD,
      });
    }
    const { status } = await post("/api/auth/reset-password", {
      token: resetToken,
      password: NEW_PASSWORD,
    });
    expect(status).toBe(429);
  });

});