import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
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

// Управление профилем кандидата
router.patch('/candidate/certificate', authMiddleware, addCertificate);
router.delete('/candidate/certificate', authMiddleware, removeCertificate);
router.patch('/candidate/video', authMiddleware, uploadVideo);
router.delete('/candidate/video', authMiddleware, removeVideo);
router.patch('/candidate/photo', authMiddleware, candidatePhotoUpload.single('photo'), uploadPhoto);
router.delete('/candidate/photo', authMiddleware, removePhoto);

router.get('/candidate/timezones', authMiddleware, getTimezones);
router.patch('/candidate/timezones', authMiddleware, addTimezone);
router.delete('/candidate/timezones', authMiddleware, removeTimezone);
// Управление файлами (резюме, сертификаты, видео, логотипы, фото)
router.post('/candidate/resume', authMiddleware, resumeUpload.single('resume'), uploadResume);
router.get('/candidate/resume', authMiddleware, getResume);
router.delete('/candidate/resume', authMiddleware, deleteResume);

router.delete('/employer/logo', authMiddleware, deleteEmployerLogo);
router.patch('/employer/logo', authMiddleware, employerLogoUpload.single('logo'), uploadEmployerLogo);

router.post('/upload', authMiddleware, chatUpload.single('file'), uploadChatFile);

export default router;