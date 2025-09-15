// config/uploadConfig.ts
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация для файлов чата
export const chatUploadDir = path.join(__dirname, '../uploads/chat-files');
export const CHAT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (увеличим для изображений)
export const CHAT_ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Конфигурация для резюме
export const resumeUploadDir = path.join(__dirname, '../uploads/resumes');
export const RESUME_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const RESUME_ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

// Конфигурация для логотипов работодателя
export const employerLogoUploadDir = path.join(__dirname, '../uploads/employer-logos');
export const LOGO_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const LOGO_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Конфигурация для фото кандидата
export const candidatePhotoUploadDir = path.join(__dirname, '../uploads/candidate-photos');
export const PHOTO_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const PHOTO_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];