import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
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

router.post('/candidate', authMiddleware, (req, res) => createCandidateProfile(req as AuthRequest, res));
router.get('/candidate', authMiddleware, (req, res) => getCandidateProfile(req as AuthRequest, res));
router.put('/candidate', authMiddleware, (req, res) => updateCandidateProfile(req as AuthRequest, res));
router.delete('/candidate', authMiddleware, (req, res) => deleteCandidateProfile(req as AuthRequest, res));

router.post('/employer', authMiddleware, (req, res) => createEmployerProfile(req as AuthRequest, res));
router.put('/employer', authMiddleware, (req, res) => updateEmployerProfile(req as AuthRequest, res));
router.get('/employer', authMiddleware, (req, res) => getEmployerProfile(req as AuthRequest, res));
router.delete('/employer', authMiddleware, (req, res) => deleteEmployerProfile(req as AuthRequest, res));

export default router;
