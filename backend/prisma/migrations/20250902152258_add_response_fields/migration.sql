/*
  Warnings:

  - A unique constraint covering the columns `[vacancyId,userId]` on the table `Response` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ResponseStatus" AS ENUM ('IN_PROGRESS', 'REVIEWED', 'REJECTED', 'ACCEPTED');

-- AlterTable
ALTER TABLE "public"."Response" ADD COLUMN     "coverLetter" TEXT,
ADD COLUMN     "resumeUrls" TEXT[],
ADD COLUMN     "status" "public"."ResponseStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- CreateIndex
CREATE UNIQUE INDEX "Response_vacancyId_userId_key" ON "public"."Response"("vacancyId", "userId");
