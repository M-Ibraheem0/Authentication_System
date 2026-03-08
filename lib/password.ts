import bcrypt from "bcryptjs";

const SALT_ROUNDS = process.env.NODE_ENV === "production" ? 10 : 12;

// max concurrent bcrypt operations
// prevents thread pool exhaustion under heavy load
const MAX_CONCURRENT = 10;
let currentOps = 0;
const queue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (currentOps < MAX_CONCURRENT) {
      currentOps++;
      resolve();
    } else {
      queue.push(() => {
        currentOps++;
        resolve();
      });
    }
  });
}

function releaseSlot(): void {
  currentOps--;
  const next = queue.shift();
  if (next) next();
}

export async function hashPassword(password: string): Promise<string> {
  await acquireSlot();
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } finally {
    releaseSlot();
  }
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  await acquireSlot();
  try {
    return await bcrypt.compare(password, hash);
  } finally {
    releaseSlot();
  }
}

export function checkPasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true };
}