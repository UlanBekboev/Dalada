import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { chatUploadDir , CHAT_MAX_FILE_SIZE, CHAT_ALLOWED_EXTENSIONS, resumeUploadDir, RESUME_MAX_FILE_SIZE, RESUME_ALLOWED_EXTENSIONS, employerLogoUploadDir, candidatePhotoUploadDir, PHOTO_ALLOWED_EXTENSIONS, PHOTO_MAX_FILE_SIZE, LOGO_MAX_FILE_SIZE, LOGO_ALLOWED_EXTENSIONS } from '../config/uploadConfig.js';

// Создаем папки для загрузок, если они не существуют
[chatUploadDir, resumeUploadDir, employerLogoUploadDir, candidatePhotoUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Конфигурация Multer для файлов чата
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, chatUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'chat-file-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const chatFileFilter = (req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (CHAT_ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Разрешены только файлы: ${CHAT_ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

export const chatUpload = multer({
  storage: chatStorage,
  limits: {
    fileSize: CHAT_MAX_FILE_SIZE,
  },
  fileFilter: chatFileFilter
});

// Конфигурация Multer для резюме
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resumeUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const resumeFileFilter = (req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (RESUME_ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Разрешены только файлы: ${RESUME_ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

export const resumeUpload = multer({
  storage: resumeStorage,
  limits: {
    fileSize: RESUME_MAX_FILE_SIZE,
  },
  fileFilter: resumeFileFilter
});

// Конфигурация Multer для логотипов работодателя
const employerLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, employerLogoUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'employer-logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const employerLogoFileFilter = (req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (LOGO_ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Разрешены только изображения: ${LOGO_ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

export const employerLogoUpload = multer({
  storage: employerLogoStorage,
  limits: {
    fileSize: LOGO_MAX_FILE_SIZE,
  },
  fileFilter: employerLogoFileFilter
});

// Конфигурация Multer для фото кандидата
const candidatePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, candidatePhotoUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'candidate-photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const candidatePhotoFileFilter = (req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (PHOTO_ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Разрешены только изображения: ${PHOTO_ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

export const candidatePhotoUpload = multer({
  storage: candidatePhotoStorage,
  limits: {
    fileSize: PHOTO_MAX_FILE_SIZE,
  },
  fileFilter: candidatePhotoFileFilter
});