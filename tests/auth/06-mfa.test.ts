import { post, get, getOTP, cleanUser, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import { describe, expect, it, beforeAll} from '@jest/globals'

const TEST_EMAIL = "test-mfa@example.com";
const TEST_PASSWORD = "TestPass123!";

let authCookies = "";

async function setupAndSignin() {
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
}

beforeAll(async () => {
  await setupAndSignin();
});

describe("GET /api/auth/mfa/setup", () => {

  it("✅ returns QR code and secret", async () => {
    const { status, data } = await get("/api/auth/mfa/setup", authCookies);
    expect(status).toBe(200);
    expect(data.qrCode).toBeDefined();
    expect(data.secret).toBeDefined();
    expect(data.secret.length).toBeGreaterThan(10);
  });

  it("❌ rejects unauthenticated request", async () => {
    const { status } = await get("/api/auth/mfa/setup", "");
    expect(status).toBe(401);
  });

});

describe("POST /api/auth/mfa/setup (confirm)", () => {

  it("❌ rejects wrong code", async () => {
    const { status, data } = await post(
      "/api/auth/mfa/setup",
      { code: "000000" },
      authCookies
    );
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  // Note: testing correct TOTP code requires speakeasy
  // See tests/auth/06b-mfa-totp.test.ts for full TOTP test

});

describe("POST /api/auth/mfa/verify", () => {

  it("❌ rejects without temp token", async () => {
    const { status } = await post("/api/auth/mfa/verify", {
      code: "000000",
    });
    expect(status).toBe(400);
  });

  it("❌ rate limits (5 per 5min)", async () => {
    await flushRateLimits();
    for (let i = 0; i < 5; i++) {
      await post("/api/auth/mfa/verify", { code: "000000" }, authCookies);
    }
    const { status } = await post(
      "/api/auth/mfa/verify",
      { code: "000000" },
      authCookies
    );
    expect(status).toBe(429);
  });

});