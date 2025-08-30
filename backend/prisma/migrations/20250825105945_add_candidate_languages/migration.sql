/*
  Warnings:

  - You are about to drop the column `position` on the `CandidateProfile` table. All the data in the column will be lost.
  - You are about to drop the column `salaryMax` on the `CandidateProfile` table. All the data in the column will be lost.
  - You are about to drop the column `salaryMin` on the `CandidateProfile` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."CandidateProfile" DROP CONSTRAINT "CandidateProfile_userId_fkey";

-- AlterTable
ALTER TABLE "public"."CandidateProfile" DROP COLUMN "position",
DROP COLUMN "salaryMax",
DROP COLUMN "salaryMin",
ADD COLUMN     "age" INTEGER,
ADD COLUMN     "certificateUrls" TEXT[],
ADD COLUMN     "desiredRole" TEXT,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "salary" INTEGER,
ADD COLUMN     "timezones" TEXT[],
ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "skills" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
