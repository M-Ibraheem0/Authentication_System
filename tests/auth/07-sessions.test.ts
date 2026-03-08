import { post, get, del, getOTP, cleanUser, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import { describe, expect, it, beforeAll} from '@jest/globals'

const TEST_EMAIL = "test-sessions@example.com";
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

describe("GET /api/auth/sessions", () => {

  it("✅ returns list of sessions", async () => {
    const { status, data } = await get("/api/auth/sessions", authCookies);
    expect(status).toBe(200);
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions.length).toBeGreaterThan(0);
  });

  it("✅ session has required fields", async () => {
    const { data } = await get("/api/auth/sessions", authCookies);
    const session = data.sessions[0];
    expect(session).toHaveProperty("id");
    expect(session).toHaveProperty("deviceInfo");
    expect(session).toHaveProperty("ipAddress");
    expect(session).toHaveProperty("createdAt");
    expect(session).toHaveProperty("expiresAt");
  });

  it("❌ rejects unauthenticated request", async () => {
    const { status } = await get("/api/auth/sessions", "");
    expect(status).toBe(401);
  });

});

describe("DELETE /api/auth/sessions", () => {

  it("✅ revokes all other sessions", async () => {
    // re-signin fresh to get clean current session
    await flushRateLimits();
    const { cookies: freshCookies } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });

    // create extra sessions
    for (let i = 0; i < 3; i++) {
      await flushRateLimits();
      await post("/api/auth/signin", {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "",
        formFillTime: 5000,
      });
    }

    await flushRateLimits();

    // revoke all others using fresh session
    const { status } = await del(
      "/api/auth/sessions?all=true",
      freshCookies!
    );
    expect(status).toBe(200);

    // only current remains
    const { data } = await get("/api/auth/sessions", freshCookies!);
    expect(data.sessions.length).toBe(1);
    expect(data.sessions[0].isCurrent).toBe(true);
  });

  it("❌ cannot revoke current session via sessionId", async () => {
    await flushRateLimits();
    const { cookies: freshCookies } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });

    const { data } = await get("/api/auth/sessions", freshCookies!);
    const current = data.sessions?.find((s: any) => s.isCurrent);

    if (current) {
      const { status } = await del(
        `/api/auth/sessions?sessionId=${current.id}`,
        freshCookies!
      );
      expect(status).toBe(403);
    }
  });

});