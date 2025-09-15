import { Router } from "express";
import { toggleFavoriteVacancy, getMyFavoriteVacancies, toggleFavoriteCandidate, getFavoriteCandidates } from "../controllers/favoriteController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.patch("/:vacancyId/vacancy", authMiddleware, toggleFavoriteVacancy); // toggle
router.get("/my/favorites", authMiddleware, getMyFavoriteVacancies); // list
router.patch("/:vacancyId/candidates/:candidateProfileId/favorite", authMiddleware, toggleFavoriteCandidate);
router.get("/:vacancyId/favorites", authMiddleware, getFavoriteCandidates); 

export default router;