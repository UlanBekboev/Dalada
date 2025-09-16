import { Router } from "express";
import { toggleFavoriteVacancy, getMyFavoriteVacancies, toggleFavoriteCandidate, getFavoriteCandidates } from "../controllers/favoriteController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.patch("/candidate/favorites/vacancy/:vacancyId", authMiddleware, toggleFavoriteVacancy); // toggle
router.get("/candidate/favorites/vacancies", authMiddleware, getMyFavoriteVacancies); // list
router.patch("/employer/favorites/:vacancyId//candidate/:candidateProfileId", authMiddleware, toggleFavoriteCandidate);
router.get("/employer/favorites/:vacancyId//candidates", authMiddleware, getFavoriteCandidates); 

export default router;