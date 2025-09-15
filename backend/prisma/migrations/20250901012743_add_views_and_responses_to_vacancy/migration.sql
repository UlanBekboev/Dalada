-- AlterTable
ALTER TABLE "public"."Vacancy" ADD COLUMN     "responsesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;
