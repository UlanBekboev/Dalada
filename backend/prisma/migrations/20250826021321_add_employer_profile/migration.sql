/*
  Warnings:

  - You are about to drop the column `city` on the `EmployerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `contactPerson` on the `EmployerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `contacts` on the `EmployerProfile` table. All the data in the column will be lost.
  - Added the required column `contactName` to the `EmployerProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."EmployerProfile" DROP COLUMN "city",
DROP COLUMN "contactPerson",
DROP COLUMN "contacts",
ADD COLUMN     "contactName" TEXT NOT NULL,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "legalInfo" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
