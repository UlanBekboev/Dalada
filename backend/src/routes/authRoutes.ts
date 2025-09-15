import { Router } from "express";
import { oauthCallback, sendOtp, verifyOtp } from "../controllers/authController.js";
// import { redirectToGoogle, googleCallback } from "../controllers/googleAuth.js";
// import { redirectToFacebook, facebookCallback } from "../controllers/facebookAuth.js";
import passport from "passport";

const router = Router();

router.post("/otp/send", sendOtp);
router.post("/otp/verify", verifyOtp);

// GOOGLE
router.get("/google", passport.authenticate("google", { scope: ["email", "profile"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), oauthCallback);

// FACEBOOK
router.get("/facebook", passport.authenticate("facebook", { scope: ["email"] }));
router.get("/facebook/callback", passport.authenticate("facebook", { session: false }), oauthCallback);

export default router;
