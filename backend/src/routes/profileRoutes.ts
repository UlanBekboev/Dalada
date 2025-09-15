import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  createCandidateProfile,
  updateCandidateProfile,
  deleteCandidateProfile,
  getCandidateProfile,
  
} from '../controllers/candidateProfileController.js';
import {
  createEmployerProfile,
  updateEmployerProfile,
  getEmployerProfile,
  deleteEmployerProfile,
} from '../controllers/employerProfileController.js';

const router = Router();

router.post('/candidate', authMiddleware, createCandidateProfile);
router.get('/candidate', authMiddleware, getCandidateProfile);
router.put('/candidate', authMiddleware, updateCandidateProfile);
router.delete('/candidate', authMiddleware, deleteCandidateProfile);

router.post('/employer', authMiddleware, createEmployerProfile);
router.put('/employer', authMiddleware, updateEmployerProfile);
router.get('/employer', authMiddleware, getEmployerProfile);
router.delete('/employer', authMiddleware, deleteEmployerProfile);

export default router;
