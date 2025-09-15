import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient.js";
import type { OTPChannel, OTPIntent, Role, User } from "@prisma/client";

const RESEND_WINDOW_MS = 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
const OTP_PEPPER = process.env.OTP_PEPPER || "";
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TTL = process.env.ACCESS_TTL || "55m";
const REFRESH_TTL = process.env.REFRESH_TTL || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const generateOTP = (): string => Math.floor(100000 + Math.random() * 900000).toString();
const hashCode = (code: string) => crypto.createHash("sha256").update(code + OTP_PEPPER).digest("hex");

const normalizeIdentifier = (identifier: string) => {
  const trimmed = identifier.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed.replace(/[^\d+]/g, "");
};

export const findUserByIdentifier = async (identifier: string) => {
  const isEmail = identifier.includes("@");
  return prisma.user.findFirst({ where: { [isEmail ? "email" : "phone"]: identifier } as any });
};

export const sendOtpService = async (payload: {
  role: Role;
  intent: OTPIntent;
  channel: OTPChannel;
  identifier: string;
  env?: string;
}) => {
  const { role, intent, channel } = payload;
  const normalizedIdentifier = normalizeIdentifier(payload.identifier);

  const lastOtp = await prisma.oTP.findFirst({
    where: { identifier: normalizedIdentifier },
    orderBy: { createdAt: "desc" },
  });

  if (lastOtp?.createdAt) {
    const timeDiff = Date.now() - lastOtp.createdAt.getTime();
    if (timeDiff < RESEND_WINDOW_MS) {
      return {
        status: 429,
        body: {
          message: "Повторная отправка возможна позже",
          retryAfterSec: Math.ceil((RESEND_WINDOW_MS - timeDiff) / 1000),
        },
      } as const;
    }
  }

  const existingUser = await findUserByIdentifier(normalizedIdentifier);

  if (intent === "REGISTER" && existingUser) {
    return { status: 409, body: { message: "Пользователь уже существует" } } as const;
  }

  if (intent === "LOGIN" && !existingUser) {
    return { status: 404, body: { message: "Пользователь не найден" } } as const;
  }

  // Инвалидируем предыдущие OTP того же intent + identifier
  await prisma.oTP.deleteMany({ where: { identifier: normalizedIdentifier, intent } });

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.oTP.create({
    data: {
      identifier: normalizedIdentifier,
      role,
      intent,
      channel,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  // В небезопасном окружении возвращаем код
  if ((payload.env || process.env.NODE_ENV) !== "production") {
    return { status: 200, body: { message: "Код отправлен", debugCode: code, expiresIn: CODE_TTL_MS / 1000 } } as const;
  }

  // TODO: интегрировать отправку SMS / Email
  return { status: 200, body: { message: "Код отправлен" } } as const;
};

export const verifyOtpService = async (payload: {
  identifier: string;
  code: string;
  intent: OTPIntent;
  role: Role;
}) => {
  const normalizedIdentifier = normalizeIdentifier(payload.identifier);

  const otpRecord = await prisma.oTP.findFirst({
    where: { identifier: normalizedIdentifier, intent: payload.intent },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) return { status: 400, body: { message: "Код не найден" } } as const;

  if (otpRecord.expiresAt < new Date()) {
    await prisma.oTP.delete({ where: { id: otpRecord.id } });
    return { status: 400, body: { message: "Код устарел" } } as const;
  }

  if (otpRecord.codeHash !== hashCode(payload.code)) {
    return { status: 400, body: { message: "Неверный код" } } as const;
  }

  // Удаляем использованный код
  await prisma.oTP.delete({ where: { id: otpRecord.id } });

  // Найдём или создадим пользователя
  let user = await findUserByIdentifier(normalizedIdentifier);

  if (payload.intent === "REGISTER") {
    if (user) return { status: 409, body: { message: "Пользователь уже существует" } } as const;

    user = await prisma.user.create({
      data: {
        role: payload.role,
        email: normalizedIdentifier.includes("@") ? normalizedIdentifier : null,
        phone: !normalizedIdentifier.includes("@") ? normalizedIdentifier : null,
      },
    });
  } else if (!user) {
    return { status: 404, body: { message: "Пользователь не найден" } } as const;
  }

  const tokens = generateTokens(user as User);

  return {
    status: 200,
    body: {
      message: "Успешная аутентификация",
      user: { id: user!.id, email: user!.email, phone: user!.phone, role: user!.role },
      ...tokens,
    },
  } as const;
};

export const generateTokens = (user: User) => {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET as jwt.Secret,
    { expiresIn: ACCESS_TTL as jwt.SignOptions["expiresIn"] }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_SECRET as jwt.Secret,
    { expiresIn: REFRESH_TTL as jwt.SignOptions["expiresIn"] }
  );

  return { accessToken, refreshToken };
};