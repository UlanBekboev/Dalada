-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "name" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
