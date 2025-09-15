import { Request, Response } from "express";
import { sendOtpService, verifyOtpService } from "../services/authService.js";

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { role, intent, channel, identifier } = req.body;
    const result = await sendOtpService({ role, intent, channel, identifier, env: process.env.NODE_ENV });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { identifier, code, intent, role } = req.body;
    const result = await verifyOtpService({ identifier, code, intent, role });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
};

export const oauthCallback = async (req: Request, res: Response) => {
  // Passport places profile in req.user
  try {
    const { role, intent } = req.query as any;
    const userFromPassport = req.user as any;

    if (!userFromPassport?.email) return res.status(400).json({ message: "Ошибка аутентификации" });

    // Здесь можно делегировать в service, но для простоты оставим локально
    // находим пользователя
    const findOrCreate = async () => {
      // import prisma lazily to avoid circular import in some setups
      const { prisma } = await import("../prismaClient.js");
      let user = await prisma.user.findUnique({ where: { email: userFromPassport.email } });

      if (intent === "REGISTER") {
        if (user) return { status: 409, body: { message: "Пользователь уже существует" } } as const;
        if (!role) return { status: 400, body: { message: "Требуется роль" } } as const;

        user = await prisma.user.create({ data: { email: userFromPassport.email, role, phone: null } });
      } else if (!user) {
        return { status: 404, body: { message: "Пользователь не найден" } } as const;
      }

      // generate tokens
      const { generateTokens } = await import("../services/authService.js");
      const tokens = generateTokens(user as any);
      return { status: 200, body: { message: `Успешная авторизация через ${userFromPassport.provider}`, user: { id: user!.id, email: user!.email, role: user!.role }, ...tokens } } as const;
    };

    const result = await findOrCreate();
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("OAuth error:", error);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
};