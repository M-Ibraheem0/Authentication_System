import {
  post,
  getOTP,
  cleanUser,
  flushRateLimits,
  MOCK_TURNSTILE,
} from "../helpers";
import { describe, expect, it } from "@jest/globals";
import { redis } from "@/lib/redis";

// helper — create and verify a user
async function createVerifiedUser(email: string, password = "TestPass123!") {
  await cleanUser(email);
  await post("/api/auth/signup", {
    email,
    password,
    turnstileToken: MOCK_TURNSTILE,
    honeypot: "",
    formFillTime: 5000,
  });
  const otp = await getOTP(email);
  await post("/api/auth/verify-email", { email, otp });
}

describe("Concurrency — bcrypt + DB queue", () => {

  it(
    "✅ 20 concurrent signins — all succeed, no crashes",
    async () => {
      const emails = Array.from(
        { length: 20 },
        (_, i) => `concurrent_signin_${i}@example.com`
      );

      // setup users sequentially (not concurrent — avoid rate limits)
      for (const email of emails) {
        await createVerifiedUser(email);
      }

      await flushRateLimits();

      // NOW hit signin concurrently
      const start = Date.now();
      const results = await Promise.all(
        emails.map((email) =>
          post("/api/auth/signin", {
            email,
            password: "TestPass123!",
            turnstileToken: MOCK_TURNSTILE,
            honeypot: "",
            formFillTime: 5000,
          })
        )
      );
      const elapsed = Date.now() - start;

      const successes = results.filter((r) => r.status === 200);
      const failures = results.filter((r) => r.status !== 200);

      console.log(`
        ⚡ Concurrent signin (20):
        ✅ Success:  ${successes.length}
        ❌ Failed:   ${failures.length}
        ⏱  Time:     ${elapsed}ms
        📊 Avg/req:  ${Math.round(elapsed / results.length)}ms
        ${failures.length > 0 ? `\n        Failed statuses: ${[...new Set(failures.map(f => f.status))].join(", ")}` : ""}
      `);

      expect(successes.length).toBe(20);
      expect(failures.length).toBe(0);
      expect(elapsed).toBeLessThan(15000); // 15s max
    },
    60000
  );

  it(
    "✅ 20 concurrent signups — all succeed, no crashes",
    async () => {
      const ts = Date.now();
      const emails = Array.from(
        { length: 20 },
        (_, i) => `concurrent_signup_${ts}_${i}@example.com`
      );

      // clean first
      for (const email of emails) {
        await cleanUser(email);
      }

      await flushRateLimits();

      // hit signup concurrently
      const start = Date.now();
      const results = await Promise.all(
        emails.map((email) =>
          post("/api/auth/signup", {
            email,
            password: "TestPass123!",
            turnstileToken: MOCK_TURNSTILE,
            honeypot: "",
            formFillTime: 5000,
          })
        )
      );
      const elapsed = Date.now() - start;

      const successes = results.filter((r) => r.status === 201);
      const failures = results.filter((r) => r.status !== 201);

      console.log(`
        ⚡ Concurrent signup (20):
        ✅ Success:  ${successes.length}
        ❌ Failed:   ${failures.length}
        ⏱  Time:     ${elapsed}ms
        📊 Avg/req:  ${Math.round(elapsed / results.length)}ms
        ${failures.length > 0 ? `\n        Failed statuses: ${[...new Set(failures.map(f => f.status))].join(", ")}` : ""}
      `);

      expect(successes.length).toBe(20);
      expect(failures.length).toBe(0);
      expect(elapsed).toBeLessThan(20000);
    },
    60000
  );

  it(
    "✅ 20 concurrent OTP verifications — all succeed",
    async () => {
      const ts = Date.now();
      const emails = Array.from(
        { length: 20 },
        (_, i) => `concurrent_otp_${ts}_${i}@example.com`
      );

      // signup all first
      for (const email of emails) {
        await cleanUser(email);
        await post("/api/auth/signup", {
          email,
          password: "TestPass123!",
          turnstileToken: MOCK_TURNSTILE,
          honeypot: "",
          formFillTime: 5000,
        });
      }

      // get all OTPs
      const otps = await Promise.all(emails.map((email) => getOTP(email)));

      await flushRateLimits();

      // verify all concurrently
      const start = Date.now();
      const results = await Promise.all(
        emails.map((email, i) =>
          post("/api/auth/verify-email", {
            email,
            otp: otps[i],
          })
        )
      );
      const elapsed = Date.now() - start;

      const successes = results.filter((r) => r.status === 200);
      const failures = results.filter((r) => r.status !== 200);

      console.log(`
        ⚡ Concurrent OTP verify (20):
        ✅ Success:  ${successes.length}
        ❌ Failed:   ${failures.length}
        ⏱  Time:     ${elapsed}ms
      `);

      expect(successes.length).toBe(20);
      expect(failures.length).toBe(0);
      expect(elapsed).toBeLessThan(10000);
    },
    60000
  );

  it(
    "✅ 20 concurrent refresh token rotations — all succeed",
    async () => {
      const emails = Array.from(
        { length: 20 },
        (_, i) => `concurrent_refresh_${i}@example.com`
      );

      // create users + signin to get cookies
      const cookiesList: string[] = [];
      for (const email of emails) {
        await createVerifiedUser(email);
      }
      await flushRateLimits();

      for (const email of emails) {
        const { cookies } = await post("/api/auth/signin", {
          email,
          password: "TestPass123!",
          turnstileToken: MOCK_TURNSTILE,
          honeypot: "",
          formFillTime: 5000,
        });
        cookiesList.push(cookies ?? "");
      }

      await flushRateLimits();

      // refresh all concurrently
      const start = Date.now();
      const results = await Promise.all(
        cookiesList.map((cookies) =>
          post("/api/auth/refresh", {}, cookies)
        )
      );
      const elapsed = Date.now() - start;

      const successes = results.filter((r) => r.status === 200);
      const failures = results.filter((r) => r.status !== 200);

      console.log(`
        ⚡ Concurrent refresh (20):
        ✅ Success:  ${successes.length}
        ❌ Failed:   ${failures.length}
        ⏱  Time:     ${elapsed}ms
      `);

      expect(successes.length).toBe(20);
      expect(failures.length).toBe(0);
      expect(elapsed).toBeLessThan(10000);
    },
    60000
  );

  it(
    "✅ mixed concurrent load — signup + signin + refresh simultaneously",
    async () => {
      const ts = Date.now();

      // pre-create some users for signin + refresh
      const signinEmails = Array.from(
        { length: 10 },
        (_, i) => `mixed_signin_${i}@example.com`
      );
      for (const email of signinEmails) {
        await createVerifiedUser(email);
      }

      const signinCookies: string[] = [];
      await flushRateLimits();
      for (const email of signinEmails) {
        const { cookies } = await post("/api/auth/signin", {
          email,
          password: "TestPass123!",
          turnstileToken: MOCK_TURNSTILE,
          honeypot: "",
          formFillTime: 5000,
        });
        signinCookies.push(cookies ?? "");
      }

      await flushRateLimits();

      // fire all three types at once
      const start = Date.now();
      const [signupResults, signinResults, refreshResults] = await Promise.all([
        // 10 concurrent signups
        Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            post("/api/auth/signup", {
              email: `mixed_new_${ts}_${i}@example.com`,
              password: "TestPass123!",
              turnstileToken: MOCK_TURNSTILE,
              honeypot: "",
              formFillTime: 5000,
            })
          )
        ),
        // 10 concurrent signins
        Promise.all(
          signinEmails.map((email) =>
            post("/api/auth/signin", {
              email,
              password: "TestPass123!",
              turnstileToken: MOCK_TURNSTILE,
              honeypot: "",
              formFillTime: 5000,
            })
          )
        ),
        // 10 concurrent refreshes
        Promise.all(
          signinCookies.map((cookies) =>
            post("/api/auth/refresh", {}, cookies)
          )
        ),
      ]);

      const elapsed = Date.now() - start;

      const signupOk = signupResults.filter((r) => r.status === 201).length;
      const signinOk = signinResults.filter((r) => r.status === 200).length;
      const refreshOk = refreshResults.filter((r) => r.status === 200).length;

      console.log(`
        ⚡ Mixed concurrent load (30 total):
        📝 Signups:  ${signupOk}/10
        🔑 Signins:  ${signinOk}/10
        🔄 Refreshes: ${refreshOk}/10
        ⏱  Time:     ${elapsed}ms
        📊 Avg/req:  ${Math.round(elapsed / 30)}ms
      `);

      expect(signupOk).toBe(10);
      expect(signinOk).toBe(10);
      expect(refreshOk).toBe(10);
      expect(elapsed).toBeLessThan(20000);
    },
    90000
  );

  it(
    "✅ bcrypt queue — 50 concurrent signins queued properly",
    async () => {
      const emails = Array.from(
        { length: 50 },
        (_, i) => `queue_test_${i}@example.com`
      );

      for (const email of emails) {
        await createVerifiedUser(email);
      }

      await flushRateLimits();

      const start = Date.now();
      const results = await Promise.all(
        emails.map((email) =>
          post("/api/auth/signin", {
            email,
            password: "TestPass123!",
            turnstileToken: MOCK_TURNSTILE,
            honeypot: "",
            formFillTime: 5000,
          })
        )
      );
      const elapsed = Date.now() - start;

      const successes = results.filter((r) => r.status === 200);
      const timeouts = results.filter((r) => r.status === 504);

      console.log(`
        ⚡ bcrypt queue stress test (50 concurrent):
        ✅ Success:  ${successes.length}
        ⏱  Timeout:  ${timeouts.length}
        🕐 Total:    ${elapsed}ms
        📊 Avg/req:  ${Math.round(elapsed / results.length)}ms
        
        Expected behavior:
        - Max 10 bcrypt ops at once
        - Others queue up (no timeout)
        - All 50 complete eventually
        - Total ~${50 / 10 * 100}ms minimum (10 batches × 100ms)
      `);

      // all should succeed — queue prevents crashes
      expect(successes.length).toBe(50);
      // should complete in reasonable time
      // 50 users / 10 concurrent = 5 batches × ~100ms = ~500ms minimum
      // with overhead, allow 30s max
      expect(elapsed).toBeLessThan(30000);
    },
    120000
  );

});