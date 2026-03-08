import speakeasy from "speakeasy";
import { post, get, getOTP, cleanUser, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import { describe, expect, it, beforeAll} from '@jest/globals'

const TEST_EMAIL = "test-mfa-totp@example.com";
const TEST_PASSWORD = "TestPass123!";

let authCookies = "";
let totpSecret = "";

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

  // get TOTP secret
  const { data } = await get("/api/auth/mfa/setup", authCookies);
  totpSecret = data.secret;
});

describe("MFA Full TOTP Flow", () => {

  it("✅ enables MFA with correct TOTP code", async () => {
    const code = speakeasy.totp({
      secret: totpSecret,
      encoding: "base32",
    });

    const { status } = await post(
      "/api/auth/mfa/setup",
      { code },
      authCookies
    );
    expect(status).toBe(200);
  });

  it("✅ signin requires MFA after enabling", async () => {
    await flushRateLimits();
    const { status, data } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(200);
    expect(data.requiresMfa).toBe(true);
    expect(data.tempToken).toBeDefined();
  });

  it("✅ completes signin with correct TOTP code", async () => {
    await flushRateLimits();
    const { data: signinData } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });

    const code = speakeasy.totp({
      secret: totpSecret,
      encoding: "base32",
    });

    const { status, cookies } = await post(
      "/api/auth/mfa/verify",
      { code, tempToken: signinData.tempToken },
      ""
    );
    expect(status).toBe(200);
    expect(cookies).toContain("access_token");
  });

  it("❌ rejects wrong TOTP code", async () => {
    await flushRateLimits();
    const { data: signinData } = await post("/api/auth/signin", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });

    const { status } = await post(
      "/api/auth/mfa/verify",
      { code: "000000", tempToken: signinData.tempToken },
      ""
    );
    expect(status).toBe(400);
  });

});