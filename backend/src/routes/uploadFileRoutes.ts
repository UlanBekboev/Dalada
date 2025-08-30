import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import {
  upsertCandidateLanguage,
  deleteCandidateLanguage,
} from '../controllers/candidateProfileController.js';
import {
  uploadResume,
  addCertificate,
  removeCertificate,
  uploadVideo,
  removeVideo,
  deleteEmployerLogo,
  uploadEmployerLogo,
  uploadPhoto,
  removePhoto,
  addTimezone,
  getTimezones,
  removeTimezone,
} from '../controllers/uploadFiles.js';

const router = Router();

router.patch('/candidate/languages', authMiddleware, (req, res) => upsertCandidateLanguage(req as AuthRequest, res));
router.delete('/candidate/languages/:language', authMiddleware, (req, res) =>
  deleteCandidateLanguage(req as AuthRequest, res),
);
router.patch('/candidate/certificate', authMiddleware, (req, res) => addCertificate(req as AuthRequest, res));
router.delete('/candidate/certificate', authMiddleware, (req, res) => removeCertificate(req as AuthRequest, res));
router.patch('/candidate/video', authMiddleware, (req, res) => uploadVideo(req as AuthRequest, res));
router.delete('/candidate/video', authMiddleware, (req, res) => removeVideo(req as AuthRequest, res));
router.patch('/candidate/resume', authMiddleware, (req, res) => uploadResume(req as AuthRequest, res));
router.patch('candidate/photo', authMiddleware, (req, res) => uploadPhoto(req as AuthRequest, res));
router.delete('candidate/photo', authMiddleware, (req, res) => removePhoto(req as AuthRequest, res));
router.get('candidate/timezones', authMiddleware, (req, res) => getTimezones(req as AuthRequest, res));
router.patch('candidate/timezones', authMiddleware, (req, res) => addTimezone(req as AuthRequest, res));
router.delete('candidate/timezones', authMiddleware, (req, res) => removeTimezone(req as AuthRequest, res));

router.delete('employer/logo', authMiddleware, (req, res) => deleteEmployerLogo(req as AuthRequest, res));
router.patch('employer/logo', authMiddleware, (req, res) => uploadEmployerLogo(req as AuthRequest, res));

export default router;
