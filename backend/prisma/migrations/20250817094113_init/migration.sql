-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('CANDIDATE', 'EMPLOYER');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");
