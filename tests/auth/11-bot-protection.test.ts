import { post, flushRateLimits, MOCK_TURNSTILE } from "../helpers";
import {beforeEach, describe, expect, it} from '@jest/globals'

beforeEach(async () => {
  await flushRateLimits();
});

describe("Bot Protection", () => {

  // tests/auth/11-bot-protection.test.ts
    it("✅ honeypot blocks bots on signup", async () => {
    const { status, data } = await post("/api/auth/signup", {
        email: "bot@example.com",
        password: "TestPass123!",
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "filled-by-bot",
        formFillTime: 5000,
    });
    // honeypot returns silent 200 — don't reveal to bots
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    });

    it("✅ honeypot blocks bots on signin", async () => {
    const { status, data } = await post("/api/auth/signin", {
        email: "bot@example.com",
        password: "TestPass123!",
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "filled-by-bot",
        formFillTime: 5000,
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    });

  it("✅ form fill too fast blocked on signup", async () => {
    const { status } = await post("/api/auth/signup", {
        email: `fastbot${Date.now()}@example.com`,
        password: "TestPass123!",
        turnstileToken: MOCK_TURNSTILE,
        honeypot: "",
        formFillTime: 50,
    });
    expect(status).toBe(400);
    });

  it("✅ form fill too fast blocked on signin", async () => {
    const { status } = await post("/api/auth/signin", {
      email: "bot@example.com",
      password: "TestPass123!",
      turnstileToken: MOCK_TURNSTILE,
      honeypot: "",
      formFillTime: 50,
    });
    expect(status).toBe(400);
  });

});