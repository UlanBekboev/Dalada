-- CreateEnum
CREATE TYPE "public"."VacancyStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "public"."Vacancy" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT,
    "salaryFrom" INTEGER,
    "salaryTo" INTEGER,
    "currency" TEXT,
    "schedule" TEXT,
    "experienceFrom" INTEGER,
    "experienceTo" INTEGER,
    "description" TEXT,
    "timezone" TEXT,
    "employmentType" TEXT,
    "location" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "messenger" TEXT,
    "hidePhone" BOOLEAN NOT NULL DEFAULT false,
    "hideEmail" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."VacancyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Vacancy" ADD CONSTRAINT "Vacancy_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "public"."EmployerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
