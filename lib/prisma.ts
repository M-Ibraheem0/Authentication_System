import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// max 40 concurrent DB operations
// keeps Neon free tier safe (100 max connections)
const MAX_DB_CONCURRENT = 40;
let currentDbOps = 0;
const dbQueue: (() => void)[] = [];

function acquireDbSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (currentDbOps < MAX_DB_CONCURRENT) {
      currentDbOps++;
      resolve();
    } else {
      dbQueue.push(() => {
        currentDbOps++;
        resolve();
      });
    }
  });
}

function releaseDbSlot(): void {
  currentDbOps--;
  const next = dbQueue.shift();
  if (next) next();
}

export async function db<T>(operation: () => Promise<T>): Promise<T> {
  await acquireDbSlot();
  try {
    return await operation();
  } finally {
    releaseDbSlot();
  }
}