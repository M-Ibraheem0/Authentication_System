import { post, getOTP, cleanUser, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import {beforeEach, describe, expect, it} from '@jest/globals'
const TEST_EMAIL = "test-signup@example.com";
const TEST_PASSWORD = "TestPass123!";

beforeEach(async () => {
  await cleanUser(TEST_EMAIL);
  await flushRateLimits();
});

describe("POST /api/auth/signup", () => {

  it("✅ creates pending signup and returns 201", async () => {
    const { status, data } = await post("/api/auth/signup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(201);
    expect(data.message).toContain("Check your email");
  });

  it("✅ OTP stored in Redis", async () => {
    await post("/api/auth/signup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    const otp = await getOTP(TEST_EMAIL);
    expect(otp).toHaveLength(6);
    expect(Number(otp)).not.toBeNaN();
  });

  it("❌ rejects duplicate email (already verified)", async () => {
    // first signup + verify
    await post("/api/auth/signup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    const otp = await getOTP(TEST_EMAIL);
    await post("/api/auth/verify-email", { email: TEST_EMAIL, otp });

    // try signup again
    const { status, data } = await post("/api/auth/signup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("❌ rejects honeypot filled", async () => {
    const { status } = await post("/api/auth/signup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "i-am-a-bot",
      formFillTime: 5000,
    });
    expect(status).toBe(200);
  });

  it("❌ rejects form filled too fast (bot)", async () => {
    const { status } = await post("/api/auth/signup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 100, // too fast
    });
    expect(status).toBe(400);
  });

  it("❌ rejects weak password", async () => {
    const { status, data } = await post("/api/auth/signup", {
      email: TEST_EMAIL,
      password: "weak",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("❌ rejects invalid email", async () => {
    const { status } = await post("/api/auth/signup", {
      email: "not-an-email",
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(400);
  });

  it("❌ rejects missing fields", async () => {
    const { status } = await post("/api/auth/signup", {});
    expect(status).toBe(400);
  });

});