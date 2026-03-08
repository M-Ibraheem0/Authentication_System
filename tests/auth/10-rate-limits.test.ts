import { post, flushRateLimits, MOCK_TURNSTILE, cleanUser, getOTP } from "../helpers";
import {beforeEach, describe, expect, it} from '@jest/globals'

beforeEach(async () => {
  await flushRateLimits();
});

describe("Rate Limiting — All Endpoints", () => {

  it("✅ signup sliding window — 5 per hour per fingerprint", async () => {
    const ts = Date.now();
    for (let i = 0; i < 5; i++) {
      await post("/api/auth/signup", {
        email: `rl_signup${ts}_${i}@example.com`,
        password: "TestPass123!",
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "",
        formFillTime: 5000,
      });
    }
    const { status } = await post("/api/auth/signup", {
      email: `rl_signup${ts}_6@example.com`,
      password: "TestPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(429);
  });

  it("✅ signin sliding window — 10 per 15min per fingerprint", async () => {
    const ts = Date.now();
    // use non-existent emails so no lockout is triggered
    // lockout is per-user, rate limit is per-fingerprint
    for (let i = 0; i < 10; i++) {
      await post("/api/auth/signin", {
        email: `rl_signin${ts}_${i}@example.com`,
        password: "WrongPass123!",
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "",
        formFillTime: 5000,
      });
    }
    const { status } = await post("/api/auth/signin", {
      email: `rl_signin${ts}_11@example.com`,
      password: "WrongPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(429);
  });

  it("✅ forgot password — 1 per week per user", async () => {
    const email = `rl_forgot_${Date.now()}@example.com`;

    // create verified user first
    await post("/api/auth/signup", {
      email,
      password: "TestPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    const otp = await getOTP(email);
    await post("/api/auth/verify-email", { email, otp });

    // first request — should succeed
    const { status: first } = await post("/api/auth/forgot-password", { email });
    expect(first).toBe(200);

    // second request — should be rate limited
    const { status: second } = await post("/api/auth/forgot-password", { email });
    expect(second).toBe(429);
  });

  it("✅ reset password — 5 per hour per IP", async () => {
    // hit with fake tokens to trigger rate limit
    for (let i = 0; i < 5; i++) {
      await post("/api/auth/reset-password", {
        token: `fake-token-${i}`,
        password: "TestPass123!",
      });
    }
    const { status } = await post("/api/auth/reset-password", {
      token: "fake-token-final",
      password: "TestPass123!",
    });
    expect(status).toBe(429);
  });

  it("✅ MFA verify — 5 per 5min per IP", async () => {
    for (let i = 0; i < 5; i++) {
      await post("/api/auth/mfa/verify", {
        code: "000000",
        tempToken: `fake-temp-token-${i}`,
      });
    }
    const { status } = await post("/api/auth/mfa/verify", {
      code: "000000",
      tempToken: "fake-temp-token-final",
    });
    expect(status).toBe(429);
  });

  it("✅ verify email — 5 per 10min per email", async () => {
    const email = `rl_verify_${Date.now()}@example.com`;

    // create pending signup first
    await post("/api/auth/signup", {
      email,
      password: "TestPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });

    // hit 5 wrong OTPs
    for (let i = 0; i < 5; i++) {
      await post("/api/auth/verify-email", {
        email,
        otp: "000000",
      });
    }

    const { status } = await post("/api/auth/verify-email", {
      email,
      otp: "000000",
    });
    expect(status).toBe(429);
  });

  it("✅ signin lockout — 5 failed attempts locks account", async () => {
    const email = `lockout_${Date.now()}@example.com`;

    // create verified user
    await post("/api/auth/signup", {
      email,
      password: "TestPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    const otp = await getOTP(email);
    await post("/api/auth/verify-email", { email, otp });
    await flushRateLimits();

    // 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      await post("/api/auth/signin", {
        email,
        password: "WrongPass123!",
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "",
        formFillTime: 5000,
      });
    }

    // correct password — still blocked
    const { status } = await post("/api/auth/signin", {
      email,
      password: "TestPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    expect(status).toBe(423); // locked
  });

  it("✅ change password — 5 per hour per user", async () => {
    const email = `rl_changepw_${Date.now()}@example.com`;

    // create + verify + signin
    await post("/api/auth/signup", {
      email,
      password: "TestPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });
    const otp = await getOTP(email);
    await post("/api/auth/verify-email", { email, otp });
    await flushRateLimits();

    const { cookies } = await post("/api/auth/signin", {
      email,
      password: "TestPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 5000,
    });

    // hit 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      await post(
        "/api/user/change-password",
        { currentPassword: "wrong", newPassword: "NewPass456!" },
        cookies!
      );
    }

    // correct attempt — still blocked
    const { status } = await post(
      "/api/user/change-password",
      { currentPassword: "TestPass123!", newPassword: "NewPass456!" },
      cookies!
    );
    expect(status).toBe(429);
  });

});