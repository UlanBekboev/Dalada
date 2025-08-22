/*
  Warnings:

  - You are about to drop the column `code` on the `OTP` table. All the data in the column will be lost.
  - Added the required column `channel` to the `OTP` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codeHash` to the `OTP` table without a default value. This is not possible if the table is not empty.
  - Added the required column `intent` to the `OTP` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `OTP` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."OTPIntent" AS ENUM ('LOGIN', 'REGISTER');

-- CreateEnum
CREATE TYPE "public"."OTPChannel" AS ENUM ('EMAIL', 'PHONE');

-- AlterTable
ALTER TABLE "public"."OTP" DROP COLUMN "code",
ADD COLUMN     "channel" "public"."OTPChannel" NOT NULL,
ADD COLUMN     "codeHash" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "intent" "public"."OTPIntent" NOT NULL,
ADD COLUMN     "role" "public"."Role" NOT NULL,
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "OTP_identifier_idx" ON "public"."OTP"("identifier");
