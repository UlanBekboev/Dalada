import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { prisma } from "../prismaClient.js";

// GOOGLE
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value.toLowerCase();
      if (!email) return done(null, false);

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // ⚠️ роль и intent будем обрабатывать в контроллере
        return done(null, { email, provider: "GOOGLE" });
      }
      return done(null, user);
    } catch (err) {
      done(err);
    }
  }
));

// FACEBOOK
passport.use(new FacebookStrategy(
  {
    clientID: process.env.FB_CLIENT_ID!,
    clientSecret: process.env.FB_CLIENT_SECRET!,
    callbackURL: "/auth/facebook/callback",
    profileFields: ["id", "emails", "name"],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value.toLowerCase();
      if (!email) return done(null, false);

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return done(null, { email, provider: "FACEBOOK" });
      }
      return done(null, user);
    } catch (err) {
      done(err);
    }
  }
));
