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

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Аутентификация пользователей
 */

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     summary: Отправка OTP на email или телефон
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *               - intent
 *               - channel
 *               - identifier
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [CANDIDATE, EMPLOYER]
 *                 example: CANDIDATE
 *               intent:
 *                 type: string
 *                 enum: [LOGIN, REGISTER]
 *                 example: REGISTER
 *               channel:
 *                 type: string
 *                 enum: [EMAIL, PHONE]
 *                 example: EMAIL
 *               identifier:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP успешно отправлено
 *       400:
 *         description: Ошибка валидации входных данных
 *       500:
 *         description: Ошибка сервера
 */

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Проверка OTP
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - code
 *               - intent
 *               - role
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: user@example.com
 *               code:
 *                 type: string
 *                 example: "123456"
 *               intent:
 *                 type: string
 *                 enum: [LOGIN, REGISTER]
 *                 example: LOGIN
 *               role:
 *                 type: string
 *                 enum: [CANDIDATE, EMPLOYER]
 *                 example: CANDIDATE
 *     responses:
 *       200:
 *         description: OTP подтвержден
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Неверный код OTP
 *       500:
 *         description: Ошибка сервера
 */

/**
 * @swagger
 * /auth/oauth/callback:
 *   get:
 *     summary: Callback для OAuth (Google/Facebook)
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [CANDIDATE, EMPLOYER]
 *         required: false
 *         description: Роль пользователя (только для регистрации)
 *       - in: query
 *         name: intent
 *         schema:
 *           type: string
 *           enum: [LOGIN, REGISTER]
 *         required: true
 *         description: Намерение (вход или регистрация)
 *     responses:
 *       200:
 *         description: Успешная авторизация через OAuth
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Ошибка аутентификации
 *       404:
 *         description: Пользователь не найден
 *       409:
 *         description: Пользователь уже существует
 *       500:
 *         description: Ошибка сервера
 */