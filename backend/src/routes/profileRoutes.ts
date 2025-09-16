import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  createCandidateProfile,
  updateCandidateProfile,
  deleteCandidateProfile,
  getCandidateProfile,
  upsertCandidateLanguage,
  deleteCandidateLanguage,
} from '../controllers/candidateProfileController.js';
import {
  createEmployerProfile,
  updateEmployerProfile,
  getEmployerProfile,
  deleteEmployerProfile,
} from '../controllers/employerProfileController.js';

const router = Router();

router.post('/candidate/profile', authMiddleware, createCandidateProfile);
router.get('/candidate/profile', authMiddleware, getCandidateProfile);
router.put('/candidate/profile', authMiddleware, updateCandidateProfile);
router.delete('/candidate/profile', authMiddleware, deleteCandidateProfile);
router.patch('/candidate/languages', authMiddleware, upsertCandidateLanguage);
router.delete('/candidate/languages/:language', authMiddleware, deleteCandidateLanguage);

router.post('/employer/profile', authMiddleware, createEmployerProfile);
router.put('/employer/profile', authMiddleware, updateEmployerProfile);
router.get('/employer/profile', authMiddleware, getEmployerProfile);
router.delete('/employer/profile', authMiddleware, deleteEmployerProfile);

export default router;
