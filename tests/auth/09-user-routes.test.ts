import { post, get, getOTP, cleanUser, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import { describe, expect, it, beforeAll} from '@jest/globals'

const TEST_EMAIL = "test-user@example.com";
const TEST_PASSWORD = "TestPass123!";
const NEW_PASSWORD = "NewPass456!";

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

describe("GET /api/user/me", () => {

  it("✅ returns current user info", async () => {
    const { status, data } = await get("/api/user/me", authCookies);
    expect(status).toBe(200);
    expect(data.user.email).toBe(TEST_EMAIL);
    expect(data.user).toHaveProperty("id");
    expect(data.user).toHaveProperty("mfaEnabled");
    expect(data.user).not.toHaveProperty("hashedPassword");
  });

  it("❌ rejects unauthenticated", async () => {
    const { status } = await get("/api/user/me", "");
    expect(status).toBe(401);
  });

});

describe("POST /api/user/change-password", () => {

  it("✅ changes password successfully", async () => {
    const { status } = await post(
      "/api/user/change-password",
      {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
      },
      authCookies
    );
    expect(status).toBe(200);
  });

  it("✅ can sign in with new password", async () => {
    await flushRateLimits();
    const { status } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: NEW_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(200);
  });

  it("❌ rejects wrong current password", async () => {
    const { status, data } = await post(
      "/api/user/change-password",
      {
        currentPassword: "WrongPass123!",
        newPassword: NEW_PASSWORD,
      },
      authCookies
    );
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("❌ rejects weak new password", async () => {
    const { status } = await post(
      "/api/user/change-password",
      {
        currentPassword: TEST_PASSWORD,
        newPassword: "weak",
      },
      authCookies
    );
    expect(status).toBe(400);
  });

  it("❌ rate limits (5 per hour)", async () => {
    for (let i = 0; i < 5; i++) {
      await post(
        "/api/user/change-password",
        { currentPassword: "wrong", newPassword: NEW_PASSWORD },
        authCookies
      );
    }
    const { status } = await post(
      "/api/user/change-password",
      { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
      authCookies
    );
    expect(status).toBe(429);
  });

});