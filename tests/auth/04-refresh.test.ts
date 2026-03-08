import { post, get, getOTP, cleanUser, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import { describe, expect, it, beforeAll} from '@jest/globals'

const TEST_EMAIL = "test-refresh@example.com";
const TEST_PASSWORD = "TestPass123!";

let authCookies = "";

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

  const { cookies } = await post("/api/auth/signin", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    turnstileToken: MOCK_TURNSTILE,
    honeypot: "",
    formFillTime: 5000,
  });
  authCookies = cookies ?? "";
});

describe("POST /api/auth/refresh", () => {

  it("✅ returns new access token", async () => {
    const { status, cookies } = await post("/api/auth/refresh", {}, authCookies);
    expect(status).toBe(200);
    expect(cookies).toContain("access_token");
  });

  it("✅ rotates refresh token", async () => {
    const { cookies: newCookies } = await post("/api/auth/refresh", {}, authCookies);
    expect(newCookies).toContain("refresh_token");
    // new token should be different
    expect(newCookies).not.toBe(authCookies);
  });

  it("❌ rejects missing refresh token", async () => {
    const { status } = await post("/api/auth/refresh", {}, "");
    expect(status).toBe(401);
  });

  it("❌ rejects reused refresh token (theft detection)", async () => {
    // use the token once
    await post("/api/auth/refresh", {}, authCookies);
    // use the same old token again
    const { status } = await post("/api/auth/refresh", {}, authCookies);
    expect(status).toBe(401);
  });

});