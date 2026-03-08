# next-auth-boilerplate

A production-ready, self-hosted authentication boilerplate for Next.js 14. Built to replace third-party auth providers — no vendor lock-in, no per-user pricing, no black box.

**Total monthly cost: $0**

---

## What's inside

Everything you need for auth is already designed, built, and working. Clone it, add your env vars, and start building your actual product.

### Auth methods

- Email + password signup with OTP email verification
- Magic-free signin (bcrypt compare, no magic links needed)
- OAuth — Google and GitHub via the arctic library
- TOTP-based MFA (Google Authenticator, Authy, any TOTP app)
- Forgot password + reset password flow

### Session architecture

- JWT access tokens (15 min) + refresh token rotation (30 days)
- Redis-backed sessions — revoke any device instantly
- Silent refresh in edge middleware — users never see a logout
- Per-device session list — users can manage active sessions
- Theft detection — refresh token reuse triggers full session wipe

### Security layers (every request, in order)

1. **Honeypot** — hidden field traps bots silently
2. **Cloudflare Turnstile** — invisible bot challenge
3. **Sliding window rate limiting** — Redis, per fingerprint
4. **Suspicion score + tarpit** — HyperLogLog, fill time, IP count. Delays bots 10–30s instead of hard banning (shared IPs stay safe)
5. **Lockout** — 5 failed signins → 15 min IP lockout
6. **Zod validation** — every request body, type-safe from edge to DB

### Email pipeline

- BullMQ queue backed by Redis
- Nodemailer + Gmail SMTP (500/day free, swap to SES/Brevo in one line)
- Deduplication — same email can't queue twice per minute
- 3x retry with exponential backoff (2s → 4s → 8s)
- Dead letter queue — failures logged to Postgres `FailedJob` table
- Separate worker process so email never blocks your API response

---

## Tech stack

| Concern                          | Tool                               |
| -------------------------------- | ---------------------------------- |
| Framework                        | Next.js 14 App Router + TypeScript |
| Database                         | PostgreSQL + Prisma                |
| Cache / Sessions / Rate Limiting | Redis (ioredis)                    |
| Email Queue                      | BullMQ                             |
| Email Sender                     | Nodemailer (Gmail SMTP)            |
| Password Hashing                 | bcryptjs                           |
| Tokens                           | jose (JWT)                         |
| OAuth                            | arctic                             |
| MFA                              | otplib (TOTP)                      |
| Bot Protection                   | Cloudflare Turnstile + Honeypot    |
| UI                               | shadcn/ui + Framer Motion          |
| Validation                       | Zod                                |

---

## Infrastructure (all free tier)

| Service    | Provider    | Cost           |
| ---------- | ----------- | -------------- |
| PostgreSQL | Neon        | Free           |
| Redis      | Upstash     | Free           |
| Hosting    | Vercel      | Free           |
| Email      | Gmail SMTP  | Free (500/day) |
| Domain     | Your choice | ~$2/yr         |

---

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/next-auth-boilerplate.git
cd next-auth-boilerplate
npm install
```

### 2. Set up your environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# JWT
JWT_SECRET="your-secret-min-32-chars"

# Email (Gmail SMTP)
GMAIL_USER="you@gmail.com"
GMAIL_APP_PASSWORD="your-app-password"

# OAuth - Google
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/oauth/google/callback"

# OAuth - GitHub
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
GITHUB_REDIRECT_URI="http://localhost:3000/api/auth/oauth/github/callback"

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY="..."
NEXT_PUBLIC_TURNSTILE_SITE_KEY="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Set up the database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run the app + email worker

In two terminals:

```bash
# Terminal 1 — Next.js app
npm run dev

# Terminal 2 — Email worker (separate process)
npx tsx workers/email.worker.ts
```

Open [http://localhost:3000](http://localhost:3000) — the full auth flow is live.

---

## Project structure

```
├── app/
│   ├── auth/
│   │   ├── signup/          # Signup form
│   │   ├── signin/          # Signin form
│   │   ├── verify-email/    # OTP input (6-box, auto-advance)
│   │   ├── mfa/             # TOTP code entry
│   │   ├── forgot-password/ # Email input + Turnstile
│   │   └── reset-password/  # New password form
│   ├── dashboard/           # Protected page (your app starts here)
│   └── api/auth/
│       ├── signup/
│       ├── verify-email/
│       ├── signin/
│       ├── signout/
│       ├── refresh/
│       ├── forgot-password/
│       ├── reset-password/
│       ├── sessions/        # List + revoke sessions
│       ├── mfa/
│       │   ├── setup/
│       │   └── verify/
│       └── oauth/
│           ├── google/
│           └── github/
│
├── lib/
│   ├── auth.ts              # getAuth(), getCurrentUser()
│   ├── session.ts           # createSession(), setAuthCookies()
│   ├── tokens.ts            # JWT sign/verify, OTP generation
│   ├── password.ts          # bcrypt hash/verify/strength check
│   ├── rate-limit.ts        # Sliding window, suspicion score, tarpit
│   ├── turnstile.ts         # Cloudflare verification
│   ├── fingerprint.ts       # Device fingerprinting
│   └── email/
│       ├── queue.ts         # BullMQ queue setup
│       └── templates.ts     # Email HTML templates
│
├── workers/
│   └── email.worker.ts      # Runs separately — processes email jobs
│
├── middleware.ts             # Edge JWT verify + silent refresh
└── prisma/
    └── schema.prisma
```

---

## How the flows work

### Signup

User submits form → honeypot + turnstile + rate limit → bcrypt hash password → generate 6-digit OTP → store in Redis with 10 min TTL (not in Postgres yet) → queue email job → return 201.

User is only written to Postgres after they verify the OTP. Unverified users never touch the database.

### Signin

Lockout check → find user by email → bcrypt.compare → MFA check if enabled → createSession() → 3 cookies → redirect to dashboard.

5 failed attempts sets `lockout:{ip}` in Redis for 15 minutes. Wrong password always returns the same generic error — no email enumeration.

### Token refresh (silent)

Middleware detects expired JWT → calls `/api/auth/refresh` → SHA-256 hash the incoming refresh token → compare with Redis stored hash → rotate both tokens → new cookies → user notices nothing.

If the hashes don't match (token reuse = potential theft) → delete session → force login.

### OAuth

Click button → redirect to provider consent → callback with code → exchange for access token → fetch profile → check `OAuthAccount` in Postgres → if found: create session. If not found: check if email exists as password user → yes: link accounts. No: create new user + OAuthAccount → create session.

### Password reset

Rate limited to 1 per 7 days per user (protects email quota). Always returns 200 even if email not found — no enumeration. Token is `crypto.randomBytes(32)` → SHA-256 hashed → stored in Redis with 15 min TTL. On reset: verify token, delete from Redis, bcrypt new password, delete ALL sessions for that user.

---

## Redis key map

| Key                          | TTL     | Value                                            |
| ---------------------------- | ------- | ------------------------------------------------ |
| `pending:signup:{email}`     | 10 min  | `{ hashedPassword, otp }`                        |
| `session:{sessionId}`        | 30 days | `{ userId, hashedRefreshToken, deviceInfo, ip }` |
| `pwd-reset:{userId}`         | 15 min  | `{ hashedToken }`                                |
| `lockout:{ip}`               | 15 min  | `true`                                           |
| `otp:attempts:{email}`       | 10 min  | counter (max 3)                                  |
| `rl:signup:fp:{fingerprint}` | 1 hr    | counter (max 5)                                  |
| `rl:forgot:{userId}`         | 7 days  | counter (max 1)                                  |
| `hll:signup:emails:{ip}`     | 1 hr    | HyperLogLog                                      |

---

## Cookies

All cookies are `httpOnly`, `secure`, `sameSite: strict` — XSS-proof and CSRF-proof.

| Cookie          | Max Age | Purpose                                              |
| --------------- | ------- | ---------------------------------------------------- |
| `access_token`  | 15 min  | JWT, verified on every request without hitting Redis |
| `refresh_token` | 30 days | Raw bytes, used only to rotate access token          |
| `session_id`    | 30 days | Identifies Redis session for per-device revocation   |

---

## Database schema

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  hashedPassword String?   // null for OAuth-only users
  isVerified     Boolean   @default(false)
  mfaEnabled     Boolean   @default(false)
  mfaSecret      String?
  createdAt      DateTime  @default(now())
  sessions       Session[]
  oauthAccounts  OAuthAccount[]
}

model Session {
  id                 String   @id @default(cuid())
  userId             String
  hashedRefreshToken String
  deviceInfo         String?
  ipAddress          String?
  expiresAt          DateTime
  createdAt          DateTime @default(now())
  user               User     @relation(fields: [userId], references: [id])
}

model OAuthAccount {
  id                String @id @default(cuid())
  userId            String
  provider          String // "google" | "github"
  providerAccountId String
  createdAt         DateTime @default(now())
  user              User   @relation(fields: [userId], references: [id])
}

model FailedJob {
  id        String   @id @default(cuid())
  jobName   String
  payload   Json
  error     String
  createdAt DateTime @default(now())
}
```

---

## What this is not

This is not a Clerk replacement in terms of features or battle-testing. Clerk has years of production hardening, security audits, SOC2 compliance, and a dedicated team. This boilerplate is for developers who want to own their auth layer, understand every decision in it, and not pay per-user pricing for a side project or early-stage product.

Use this if you want full control. Use Clerk if you want zero maintenance.

---

## Contributing

PRs welcome. If you find a security issue, open a private issue rather than a public one.
