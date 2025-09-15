import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
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
  getResume,
  deleteResume,
  uploadChatFile,
} from '../controllers/vacancyUploadFiles.js';
import { 
  resumeUpload, 
  employerLogoUpload, 
  candidatePhotoUpload,
  chatUpload 
} from '../middleware/uploadMiddleware.js';

const router = Router();

router.patch('/candidate/languages', authMiddleware, upsertCandidateLanguage);
router.delete('/candidate/languages/:language', authMiddleware, deleteCandidateLanguage);
router.patch('/candidate/certificate', authMiddleware, addCertificate);
router.delete('/candidate/certificate', authMiddleware, removeCertificate);
router.patch('/candidate/video', authMiddleware, uploadVideo);
router.delete('/candidate/video', authMiddleware, removeVideo);
router.post('/resume/upload', authMiddleware, resumeUpload.single('resume'), uploadResume);
router.get('/resume', authMiddleware, getResume);
router.delete('/resume', authMiddleware, deleteResume);
router.patch('/candidate/photo', authMiddleware, candidatePhotoUpload.single('photo'), uploadPhoto);
router.delete('/candidate/photo', authMiddleware, removePhoto);
router.get('/candidate/timezones', authMiddleware, getTimezones);
router.patch('/candidate/timezones', authMiddleware, addTimezone);
router.delete('/candidate/timezones', authMiddleware, removeTimezone);

router.delete('/employer/logo', authMiddleware, deleteEmployerLogo);
router.patch('/employer/upload-logo', authMiddleware, employerLogoUpload.single('logo'), uploadEmployerLogo);

router.post('/upload-file', authMiddleware, chatUpload.single('file'), uploadChatFile);

export default router;