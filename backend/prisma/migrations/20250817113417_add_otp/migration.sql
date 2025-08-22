-- CreateTable
CREATE TABLE "public"."OTP" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);
