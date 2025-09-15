import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { prisma } from "../prismaClient.js";

export const initPassport = () => {
  const apiUrl = process.env.API_URL || "http://localhost:3000";

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${apiUrl}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(null, false);
          const user = await prisma.user.findUnique({ where: { email } });
          done(null, user || { email, provider: "GOOGLE" });
        } catch (err) {
          done(err as any);
        }
      }
    )
  );

  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FB_CLIENT_ID!,
        clientSecret: process.env.FB_CLIENT_SECRET!,
        callbackURL: `${apiUrl}/auth/facebook/callback`,
        profileFields: ["id", "emails", "name"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(null, false);
          const user = await prisma.user.findUnique({ where: { email } });
          done(null, user || { email, provider: "FACEBOOK" });
        } catch (err) {
          done(err as any);
        }
      }
    )
  );

  // Optional: serialize/deserialize if you use sessions (we use JWT so not required)
};