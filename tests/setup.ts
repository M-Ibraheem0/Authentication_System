import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { beforeAll, afterAll } from "@jest/globals";
// clean DB + Redis before all tests
beforeAll(async () => {
  await prisma.session.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.user.deleteMany();
  await redis.flushdb();
  console.log("✅ DB + Redis cleaned");
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

