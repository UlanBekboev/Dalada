import { Router } from "express";
import { sendOtp, verifyOtp } from "../controllers/authController.js";
import { redirectToGoogle, googleCallback } from "../controllers/googleAuth.js";
import { redirectToFacebook, facebookCallback } from "../controllers/facebookAuth.js";

const router = Router();

router.post("/otp/send", sendOtp);
router.post("/otp/verify", verifyOtp);

router.get("/google", redirectToGoogle);
router.get("/google/callback", googleCallback);
router.get("/facebook", redirectToFacebook);
router.get("/facebook/callback", facebookCallback);

export default router;
