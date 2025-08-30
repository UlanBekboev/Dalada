import { Request, Response } from "express";
import { prisma } from "../prismaClient.js";
import { OTPChannel, OTPIntent, Role } from "@prisma/client";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const RESEND_WINDOW_MS = 60 * 1000;        // 60 сек (кнопка "отправить код ещё раз")
const CODE_TTL_MS = 5 * 60 * 1000;        // 5 минут жизни кода
const OTP_PEPPER = process.env.OTP_PEPPER || "";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

// 6-значный код
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// sha256(code + pepper)
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code + OTP_PEPPER).digest("hex");
}

// нормализация идентификатора: email -> lower+trim, phone -> только цифры
function normalizeIdentifier(identifier: string): string {
  const v = identifier.trim();
  return v.includes("@") ? v.toLowerCase() : v.replace(/\D/g, "");
}

// простая валидация
function isValidRole(role: any): role is Role {
  return role === "CANDIDATE" || role === "EMPLOYER";
}
function isValidIntent(intent: any): intent is OTPIntent {
  return intent === "LOGIN" || intent === "REGISTER";
}
function isValidChannel(channel: any): channel is OTPChannel {
  return channel === "EMAIL" || channel === "PHONE";
}

// POST /auth/otp/send
export const sendOtp = async (req: Request, res: Response) => {
  try {
    let { role, intent, channel, identifier } = req.body as {
      role?: Role;
      intent?: OTPIntent;
      channel?: OTPChannel;
      identifier?: string; // email или телефон
    };

    if (!role || !intent || !channel || !identifier) {
      return res.status(400).json({ message: "role, intent, channel, identifier are required" });
    }
    if (!isValidRole(role)) return res.status(400).json({ message: "Invalid role" });
    if (!isValidIntent(intent)) return res.status(400).json({ message: "Invalid intent" });
    if (!isValidChannel(channel)) return res.status(400).json({ message: "Invalid channel" });

    identifier = normalizeIdentifier(identifier);

    // Блокируем повторную отправку в течение 60 сек
    const last = await prisma.oTP.findFirst({
      where: { identifier },
      orderBy: { createdAt: "desc" },
    });
    if (last) {
      const diff = Date.now() - last.createdAt.getTime();
      if (diff < RESEND_WINDOW_MS) {
        const retryAfterSec = Math.ceil((RESEND_WINDOW_MS - diff) / 1000);
        return res.status(429).json({
          message: "Слишком часто. Подождите перед повторной отправкой.",
          retryAfterSec,
        });
      }
    }

    // Если intent=REGISTER и пользователь уже существует → сообщаем фронту
    if (intent === "REGISTER") {
      const existing = await prisma.user.findFirst({
        where: {
            OR: [
                ...(identifier.includes("@") ? [{ email: identifier }] : []),
                ...(!identifier.includes("@") ? [{ phone: identifier }] : []),
            ],
            },
      });
      if (existing) {
        return res.status(409).json({ message: "Пользователь уже существует. Выберите 'Войти'." });
      }
    }

    // Если intent=LOGIN и пользователя нет → подсказываем зарегистрироваться
    if (intent === "LOGIN") {
      const existing = await prisma.user.findFirst({
        where: {
            OR: [
                ...(identifier.includes("@") ? [{ email: identifier }] : []),
                ...(!identifier.includes("@") ? [{ phone: identifier }] : []),
            ],
            },
      });
      if (!existing) {
        return res.status(404).json({ message: "Пользователь не найден. Выберите 'Регистрация'." });
      }
    }

    // Инвалидируем прошлые коды для этого identifier
    await prisma.oTP.deleteMany({ 
      where: {
        identifier,
        intent, // только коды того же intent
        expiresAt: { lt: new Date() }, // можно удалять устаревшие
      },
     });

    // Генерируем и сохраняем новый
    const code = generateOTP();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await prisma.oTP.create({
      data: {
        identifier,
        role,
        intent,
        channel,
        codeHash,
        expiresAt,
      },
    });

    // TODO: отправка email/SMS. В dev возвращаем код, чтобы можно было тестировать
    if (process.env.NODE_ENV !== "production") {
      return res.json({
        message: "OTP sent (dev mode)",
        debugCode: code,
        expiresInSec: CODE_TTL_MS / 1000,
      });
    }

    return res.json({ message: "OTP sent" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    let { identifier, code, intent, role } = req.body as {
      identifier?: string;
      code?: string;
      intent?: OTPIntent;
      role?: Role;
    };

    if (!identifier || !code || !intent || !role) {
      return res.status(400).json({ message: "identifier, code, intent, role are required" });
    }

    identifier = identifier.trim().includes("@")
      ? identifier.toLowerCase().trim()
      : identifier.replace(/\D/g, "");

    // ищем код в БД
    const otp = await prisma.oTP.findFirst({
      where: { identifier, intent },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) return res.status(400).json({ message: "Код не найден или уже использован" });

    if (otp.expiresAt < new Date()) {
      await prisma.oTP.delete({ where: { id: otp.id } });
      return res.status(400).json({ message: "Код истёк" });
    }

    const codeHash = hashCode(code);
    if (otp.codeHash !== codeHash) {
      return res.status(400).json({ message: "Неверный код" });
    }

    // удаляем код после использования
    await prisma.oTP.delete({ where: { id: otp.id } });

    // проверяем пользователя
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(identifier.includes("@") ? [{ email: identifier }] : []),
          ...(!identifier.includes("@") ? [{ phone: identifier }] : []),
        ],
      },
    });

    if (intent === "REGISTER") {
      if (user) return res.status(409).json({ message: "Пользователь уже существует" });
      user = await prisma.user.create({
        data: {
          role,
          email: identifier.includes("@") ? identifier : null,
          phone: !identifier.includes("@") ? identifier : null,
        },
      });
    }

    if (intent === "LOGIN") {
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
    }

    // выдаём JWT токены
    if (!user) {
        return res.status(500).json({ message: "Ошибка: пользователь не найден после верификации" });
    }
    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: ACCESS_TTL,
    });
    console.log("JWT_SECRET при генерации:", process.env.JWT_SECRET);
    const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: REFRESH_TTL });

    return res.json({
      message: "Успешная аутентификация",
      user,
      accessToken,
      refreshToken,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};
