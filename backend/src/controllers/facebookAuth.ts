// src/auth/facebook.ts
import { Request, Response } from "express";
import passport from "passport";
import { Strategy as FacebookStrategy, Profile } from "passport-facebook";
import { prisma } from "../prismaClient.js";
import jwt from "jsonwebtoken";
import { User } from "@prisma/client";

// JWT конфиг
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

// Инициализация Passport
passport.initialize();

// ----------------------
// Настройка FacebookStrategy
// ----------------------
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL!,
      profileFields: ["id", "displayName", "emails"], // чтобы email тоже приходил
      passReqToCallback: true,
    },
    async (
      req: Request,
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: (err: any, user?: User | false) => void
    ) => {
      try {
        // role приходит как query: ?role=CANDIDATE
        const roleQuery = req.query.role as string;
        const role = roleQuery === "EMPLOYER" ? "EMPLOYER" : "CANDIDATE";

        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(new Error("Facebook не вернул email"), undefined);

        // Проверяем пользователя в БД
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              role,
              provider: "FACEBOOK",
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

// GET /auth/facebook
export const redirectToFacebook = (req: Request, res: Response, next: any) => {
  passport.authenticate("facebook", {
    scope: ["email"],
  })(req, res, next);
};

// GET /auth/facebook/callback
export const facebookCallback = (req: Request, res: Response, next: any) => {
  passport.authenticate(
    "facebook",
    { session: false },
    async (err: any, user: User | false) => {
      if (err || !user) {
        return res.status(500).json({ message: "Facebook auth failed" });
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
        message: "Успешная аутентификация через Facebook",
        user,
        accessToken,
        refreshToken,
      });
    }
  )(req, res, next);
};
