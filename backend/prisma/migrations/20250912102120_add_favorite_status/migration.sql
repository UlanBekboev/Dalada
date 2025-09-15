-- AlterEnum
ALTER TYPE "public"."ResponseStatus" ADD VALUE 'FAVORITE';

-- CreateIndex
CREATE INDEX "Chat_updatedAt_idx" ON "public"."Chat"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatParticipant_userId_idx" ON "public"."ChatParticipant"("userId");

-- CreateIndex
CREATE INDEX "ChatParticipant_chatId_idx" ON "public"."ChatParticipant"("chatId");

-- CreateIndex
CREATE INDEX "Message_chatId_createdAt_idx" ON "public"."Message"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "public"."Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "public"."Message"("createdAt");

-- CreateIndex
CREATE INDEX "OTP_expiresAt_idx" ON "public"."OTP"("expiresAt");

-- CreateIndex
CREATE INDEX "OTP_createdAt_idx" ON "public"."OTP"("createdAt");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "public"."User"("phone");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");
