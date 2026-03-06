/*
  Warnings:

  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `todos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."todos" DROP CONSTRAINT "todos_userId_fkey";

-- DropTable
DROP TABLE "public"."accounts";

-- DropTable
DROP TABLE "public"."todos";

-- DropTable
DROP TABLE "public"."users";

-- DropEnum
DROP TYPE "public"."TodoStatus";

-- CreateTable
CREATE TABLE "User" (
    "userid" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userid")
);
