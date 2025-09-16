import { Router } from "express";
import passport from "passport";
import { sendOtp, verifyOtp, oauthCallback } from "../controllers/authController.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

/**
 * OTP
 */
router.post(
  "/send-otp",
  validateRequest(["role", "intent", "channel", "identifier"]),
  sendOtp
);

router.post(
  "/verify-otp",
  validateRequest(["identifier", "code", "intent", "role"]),
  verifyOtp
);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/oauth/callback",
  passport.authenticate("google", { session: false }),
  oauthCallback
);

router.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

router.get(
  "/oauth/callback",
  passport.authenticate("facebook", { session: false }),
  oauthCallback
);

export default router;