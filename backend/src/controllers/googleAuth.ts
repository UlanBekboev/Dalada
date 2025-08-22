import { Request, Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "../prismaClient.js";
import jwt from "jsonwebtoken";

// JWT конфиг
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

// Инициализация Passport
passport.initialize();

// ----------------------
// Настройка GoogleStrategy
// ----------------------
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      passReqToCallback: true, // чтобы читать req.query
    },
    async (req: Request, _accessToken, _refreshToken, profile, done) => {
      try {
        // role приходит как query: ?role=CANDIDATE
        const roleQuery = req.query.role as string;
        const role = roleQuery === "EMPLOYER" ? "EMPLOYER" : "CANDIDATE";

        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(new Error("Google не вернул email"), undefined);

        // Проверяем пользователя в БД
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              role,
              provider: "GOOGLE",
              name: profile.displayName ?? null,
            },
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

// ----------------------
// Контроллеры для маршрутов
// ----------------------

// GET /auth/google
export const redirectToGoogle = (req: Request, res: Response, next: any) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })(req, res, next);
};

// GET /auth/google/callback
export const googleCallback = (req: Request, res: Response, next: any) => {
  passport.authenticate("google", { session: false }, async (err, user) => {
    if (err || !user) {
      return res.status(500).json({ message: "Google auth failed" });
    }

    // Генерируем JWT
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TTL }
    );
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: REFRESH_TTL }
    );

    return res.json({
      message: "Успешная аутентификация через Google",
      user,
      accessToken,
      refreshToken,
    });
  })(req, res, next);
};
