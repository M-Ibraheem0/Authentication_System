import { post, getOTP, cleanUser, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import { redis } from "@/lib/redis";
import {beforeEach, describe, expect, it} from '@jest/globals'

const TEST_EMAIL = "test-verify@example.com";
const TEST_PASSWORD = "TestPass123!";

beforeEach(async () => {
  await cleanUser(TEST_EMAIL);
  await flushRateLimits();

  // create pending signup
  await post("/api/auth/signup", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    turnstileToken: MOCK_TURNSTILE,
    honeypot: "",
    formFillTime: 5000,
  });
});

describe("POST /api/auth/verify-email", () => {

  it("✅ verifies OTP and creates user in DB", async () => {
    const otp = await getOTP(TEST_EMAIL);
    const { status, data } = await post("/api/auth/verify-email", {
      email: TEST_EMAIL,
      otp,
    });
    expect(status).toBe(200);
    expect(data.message).toBeDefined();
  });

  it("✅ removes pending key from Redis after verify", async () => {
    const otp = await getOTP(TEST_EMAIL);
    await post("/api/auth/verify-email", { email: TEST_EMAIL, otp });
    const pending = await redis.get(`pending:signup:${TEST_EMAIL}`);
    expect(pending).toBeNull();
  });

  it("❌ rejects wrong OTP", async () => {
    const { status, data } = await post("/api/auth/verify-email", {
      email: TEST_EMAIL,
      otp: "000000",
    });
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("❌ locks out after 3 wrong OTP attempts", async () => {
    for (let i = 0; i < 3; i++) {
      await post("/api/auth/verify-email", {
        email: TEST_EMAIL,
        otp: "000000",
      });
    }
    // pending should be deleted after 3 wrong attempts
    const pending = await redis.get(`pending:signup:${TEST_EMAIL}`);
    expect(pending).toBeNull();
  });

  it("❌ rejects expired/missing pending", async () => {
    await redis.del(`pending:signup:${TEST_EMAIL}`);
    const { status } = await post("/api/auth/verify-email", {
      email: TEST_EMAIL,
      otp: "123456",
    });
    expect(status).toBe(400);
  });

  it("❌ rate limits verify attempts (5 per 10 min)", async () => {
    await flushRateLimits();
    for (let i = 0; i < 6; i++) {
      await post("/api/auth/verify-email", {
        email: TEST_EMAIL,
        otp: "000000",
      });
    }
    const { status } = await post("/api/auth/verify-email", {
      email: TEST_EMAIL,
      otp: "000000",
    });
    expect(status).toBe(429);
  });

});