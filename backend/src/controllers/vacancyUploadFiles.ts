import { Response } from "express";
import { prisma } from "../prismaClient.js";
import { AuthRequest } from "../middleware/authMiddleware.js";
import path from 'path';
import fs from 'fs';
import { 
  resumeUploadDir, 
  employerLogoUploadDir, 
  candidatePhotoUploadDir 
} from '../config/uploadConfig.js';
import { chatUpload } from '../middleware/uploadMiddleware.js';

export const uploadResume = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    // Проверяем, что пользователь является кандидатом
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!candidateProfile) {
      return res.status(403).json({ message: "Только кандидаты могут загружать резюме" });
    }

    // Проверяем, что файл был загружен
    if (!req.file) {
      return res.status(400).json({ message: "Файл не был загружен" });
    }

    // Генерируем безопасную ссылку
    const safeFileName = `/uploads/resumes/${req.file.filename}`;
    
    // Обновляем профиль кандидата
    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { resumeUrl: safeFileName }
    });

    return res.json({ 
      message: "Резюме загружено", 
      resumeUrl: safeFileName 
    });
  } catch (error: any) {
    console.error(error);
    
    // Удаляем загруженный файл в случае ошибки
    if (req.file) {
      fs.unlinkSync(path.join(resumeUploadDir, req.file.filename));
    }
    
    return res.status(500).json({ 
      message: "Ошибка при загрузке резюме", 
      error: error.message 
    });
  }
};

export const getResume = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    // Проверяем, является ли пользователь кандидатом
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { resumeUrl: true }
    });

    if (!candidateProfile) {
      return res.status(403).json({ message: "Только кандидаты могут просматривать резюме" });
    }

    if (!candidateProfile.resumeUrl) {
      return res.status(404).json({ message: "Резюме не найдено" });
    }

    // Извлекаем имя файла из URL
    const filename = candidateProfile.resumeUrl.split('/').pop();
    
    if (!filename) {
      return res.status(404).json({ message: "Резюме не найдено" });
    }

    const filePath = path.join(resumeUploadDir, filename);
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Файл резюме не найден" });
    }

    // Определяем Content-Type в зависимости от расширения файла
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.doc') contentType = 'application/msword';
    else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Отправляем файл
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ 
      message: "Ошибка при получении резюме", 
      error: error.message 
    });
  }
};

export const deleteResume = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    // Проверяем, является ли пользователь кандидатом
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true, resumeUrl: true }
    });

    if (!candidateProfile) {
      return res.status(403).json({ message: "Только кандидаты могут удалять резюме" });
    }

    if (!candidateProfile.resumeUrl) {
      return res.status(404).json({ message: "Резюме не найдено" });
    }

    // Извлекаем имя файла из URL
    const filename = candidateProfile.resumeUrl.split('/').pop();
    
    if (!filename) {
      // Если не удалось извлечь имя файла, просто обновляем профиль
      await prisma.candidateProfile.update({
        where: { userId },
        data: { resumeUrl: null }
      });
      return res.json({ message: "Ссылка на резюме удалена" });
    }

    const filePath = path.join(resumeUploadDir, filename);
    
    // Пытаемся удалить файл, если он существует
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Обновляем профиль кандидата
    await prisma.candidateProfile.update({
      where: { userId },
      data: { resumeUrl: null }
    });

    res.json({ message: "Резюме успешно удалено" });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ 
      message: "Ошибка при удалении резюме", 
      error: error.message 
    });
  }
};

export const addCertificate = async (req: AuthRequest, res: Response) => {
    try {
      const { certificateUrl } = req.body;

      if (!certificateUrl) {
      return res.status(400).json({ message: "certificateUrl is required" });
    }

    const updatedProfile = await prisma.candidateProfile.update({
      where: { userId: req.user?.userId },
      data: {
        certificateUrls: {
          push: certificateUrl, 
        },
      },
    });

    res.json(updatedProfile);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Ошибка при загрузке резюме", error: error.message })
    }
}

export const removeCertificate = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const { certificateUrl } = req.body;

    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Профиль не найден" });

    const updatedCertificates = profile.certificateUrls.filter(url => url !== certificateUrl);

    const updatedProfile = await prisma.candidateProfile.update({
      where: { userId },
      data: { certificateUrls: updatedCertificates }
    });

    return res.json({ message: "Сертификат удален", profile: updatedProfile });
  } catch (error: any) {
    return res.status(500).json({ message: "Ошибка при удалении сертификата", error: error.message });
  }
};

export const uploadVideo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const { videoUrl } = req.body;

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { videoUrl }
    });

    return res.json({ message: "Видео загружено", profile });
  } catch (error: any) {
    return res.status(500).json({ message: "Ошибка при загрузке видео", error: error.message });
  }
};

export const removeVideo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { videoUrl: null }
    });

    return res.json({ message: "Видео удалено", profile });
  } catch (error: any) {
    return res.status(500).json({ message: "Ошибка при удалении видео", error: error.message });
  }
};

export const uploadEmployerLogo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    if (!req.file) {
      return res.status(400).json({ message: "Файл не предоставлен" });
    }

    // Генерируем URL к загруженному файлу
    const logoUrl = `/uploads/employer-logos/${req.file.filename}`;

    const profile = await prisma.employerProfile.update({
      where: { userId },
      data: { logoUrl },
    });

    return res.json({ message: "Логотип загружен", profile });
  } catch (error: any) {
    console.error(error);
    
    // Удаляем загруженный файл в случае ошибки
    if (req.file) {
      fs.unlinkSync(path.join(employerLogoUploadDir, req.file.filename));
    }
    
    return res.status(500).json({ message: "Ошибка при загрузке логотипа", error: error.message });
  }
};

// Удаление логотипа
export const deleteEmployerLogo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    // Сначала получаем текущий профиль, чтобы узнать путь к файлу
    const profile = await prisma.employerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({ message: "Профиль не найден" });
    }

    // Если есть логотип, удаляем файл
    if (profile.logoUrl) {
      const filename = profile.logoUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(employerLogoUploadDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    // Обновляем профиль, удаляя ссылку на логотип
    const updatedProfile = await prisma.employerProfile.update({
      where: { userId },
      data: { logoUrl: null },
    });

    return res.json({ message: "Логотип удалён", profile: updatedProfile });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Ошибка при удалении логотипа", error: error.message });
  }
};

export const uploadPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    if (!req.file) {
      return res.status(400).json({ message: "Файл не предоставлен" });
    }

    // Генерируем URL к загруженному файлу
    const photoUrl = `/uploads/candidate-photos/${req.file.filename}`;

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { photoUrl }
    });

    return res.json({ message: "Фото загружено", profile });
  } catch (error: any) {
    console.error(error);
    
    // Удаляем загруженный файл в случае ошибки
    if (req.file) {
      fs.unlinkSync(path.join(candidatePhotoUploadDir, req.file.filename));
    }
    
    return res.status(500).json({ message: "Ошибка при загрузке фото", error: error.message });
  }
};

export const removePhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    // Сначала получаем текущий профиль, чтобы узнать путь к файлу
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({ message: "Профиль не найден" });
    }

    // Если есть фото, удаляем файл
    if (profile.photoUrl) {
      const filename = profile.photoUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(candidatePhotoUploadDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    // Обновляем профиль, удаляя ссылку на фото
    const updatedProfile = await prisma.candidateProfile.update({
      where: { userId },
      data: { photoUrl: null }
    });

    return res.json({ message: "Фото удалено", profile: updatedProfile });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Ошибка при удалении фото", error: error.message });
  }
};

// ----------------- TIMEZONE -----------------
export const addTimezone = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const { timezone } = req.body;
    if (!timezone) return res.status(400).json({ message: "timezone is required (например, UTC+6)" });

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: {
        timezones: { push: timezone }  // добавляем новый offset
      }
    });

    return res.json({ message: "Часовой пояс добавлен", profile });
  } catch (error: any) {
    return res.status(500).json({ message: "Ошибка при добавлении часового пояса", error: error.message });
  }
};

export const getTimezones = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { timezones: true }
    });

    return res.json({ timezones: profile?.timezones || [] });
  } catch (error: any) {
    return res.status(500).json({ message: "Ошибка при получении часовых поясов", error: error.message });
  }
};

export const removeTimezone = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const { timezone } = req.body;
    if (!timezone) return res.status(400).json({ message: "timezone is required" });

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId }
    });

    if (!profile) return res.status(404).json({ message: "Профиль не найден" });

    const updated = profile.timezones.filter(tz => tz !== timezone);

    const updatedProfile = await prisma.candidateProfile.update({
      where: { userId },
      data: { timezones: updated }
    });

    return res.json({ message: "Часовой пояс удалён", profile: updatedProfile });
  } catch (error: any) {
    return res.status(500).json({ message: "Ошибка при удалении часового пояса", error: error.message });
  }
};

export const uploadChatFile = [
  chatUpload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      if (!req.file) {
        return res.status(400).json({ error: "Файл не предоставлен" });
      }

      // Проверяем MIME-type файла
      const allowedMimeTypes = [
        'image/jpeg', 
        'image/png', 
        'image/gif', 
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        // Удаляем файл
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid file type" });
      }

      // Проверяем, что пользователь имеет доступ к чату (если передан chatId)
      const { chatId } = req.body;
      if (chatId) {
        const participant = await prisma.chatParticipant.findFirst({
          where: { chatId, userId },
        });
        if (!participant) {
          // Удаляем файл, если доступ запрещен
          fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const fileUrl = `/uploads/chat-files/${req.file.filename}`;

      res.json({ 
        success: true, 
        fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype
      });
    } catch (error: any) {
      console.error(error);
      
      // Удаляем файл в случае ошибки
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "Размер файла превышает 10MB" });
      }
      
      res.status(500).json({ error: error.message || "Ошибка при загрузке файла" });
    }
  }
];

/**
 * @swagger
 * tags:
 *   - name: Files
 *     description: "Управление файлами (резюме, сертификаты, видео, логотипы, фото)"
 *   - name: Candidate
 *     description: "Управление профилем кандидата"
 *   - name: Employer
 *     description: "Управление профилем работодателя"
 *   - name: Chat
 *     description: "Загрузка файлов для чата"
 *
 * components:
 *   schemas:
 *     FileUploadResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         fileUrl:
 *           type: string
 *         fileName:
 *           type: string
 *         fileSize:
 *           type: number
 *         fileType:
 *           type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         error:
 *           type: string
 *     CertificateRequest:
 *       type: object
 *       required:
 *         - certificateUrl
 *       properties:
 *         certificateUrl:
 *           type: string
 *     TimezoneRequest:
 *       type: object
 *       required:
 *         - timezone
 *       properties:
 *         timezone:
 *           type: string
 *           example: "UTC+6"
 *     TimezoneResponse:
 *       type: object
 *       properties:
 *         timezones:
 *           type: array
 *           items:
 *             type: string
 *     ChatFileUploadRequest:
 *       type: object
 *       properties:
 *         chatId:
 *           type: string
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /candidate/resume:
 *   post:
 *     summary: "Загрузить резюме (только кандидат)"
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "Файл резюме (PDF, DOC, DOCX)"
 *     responses:
 *       200:
 *         description: "Резюме загружено"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileUploadResponse'
 *       401:
 *         description: "Не авторизован"
 *       403:
 *         description: "Только кандидаты могут загружать резюме"
 *       500:
 *         description: "Ошибка при загрузке резюме"
 */

/**
 * @swagger
 * /candidate/resume:
 *   get:
 *     summary: "Получить резюме (только кандидат)"
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Файл резюме"
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/msword:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: "Не авторизован"
 *       403:
 *         description: "Только кандидаты могут просматривать резюме"
 *       404:
 *         description: "Резюме не найдено"
 *       500:
 *         description: "Ошибка при получении резюме"
 */

/**
 * @swagger
 * /candidate/resume:
 *   delete:
 *     summary: "Удалить резюме (только кандидат)"
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Резюме удалено"
 *       401:
 *         description: "Не авторизован"
 *       403:
 *         description: "Только кандидаты могут удалять резюме"
 *       404:
 *         description: "Резюме не найдено"
 *       500:
 *         description: "Ошибка при удалении резюме"
 */

/**
 * @swagger
 * /candidate/certificate:
 *   post:
 *     summary: "Добавить сертификат (только кандидат)"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CertificateRequest'
 *     responses:
 *       200:
 *         description: "Сертификат добавлен"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при загрузке сертификата"
 */

/**
 * @swagger
 * /candidate/certificate:
 *   delete:
 *     summary: "Удалить сертификат (только кандидат)"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CertificateRequest'
 *     responses:
 *       200:
 *         description: "Сертификат удален"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при удалении сертификата"
 */

/**
 * @swagger
 * /candidate/video:
 *   post:
 *     summary: "Загрузить видео (только кандидат)"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               videoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: "Видео загружено"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при загрузке видео"
 */

/**
 * @swagger
 * /candidate/video:
 *   delete:
 *     summary: "Удалить видео (только кандидат)"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Видео удалено"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при удалении видео"
 */

/**
 * @swagger
 * /employer/logo:
 *   post:
 *     summary: "Загрузить логотип работодателя"
 *     tags: [Employer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: "Логотип загружен"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при загрузке логотипа"
 */

/**
 * @swagger
 * /employer/logo:
 *   delete:
 *     summary: "Удалить логотип работодателя"
 *     tags: [Employer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Логотип удалён"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при удалении логотипа"
 */

/**
 * @swagger
 * /candidate/photo:
 *   post:
 *     summary: "Загрузить фото кандидата"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: "Фото загружено"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при загрузке фото"
 */

/**
 * @swagger
 * /candidate/photo:
 *   delete:
 *     summary: "Удалить фото кандидата"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Фото удалено"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при удалении фото"
 */

/**
 * @swagger
 * /candidate/timezone:
 *   post:
 *     summary: "Добавить часовой пояс кандидата"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TimezoneRequest'
 *     responses:
 *       200:
 *         description: "Часовой пояс добавлен"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при добавлении часового пояса"
 */

/**
 * @swagger
 * /candidate/timezone:
 *   get:
 *     summary: "Получить часовые пояса кандидата"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Список часовых поясов"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TimezoneResponse'
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при получении часовых поясов"
 */

/**
 * @swagger
 * /candidate/timezone:
 *   delete:
 *     summary: "Удалить часовой пояс кандидата"
 *     tags: [Candidate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TimezoneRequest'
 *     responses:
 *       200:
 *         description: "Часовой пояс удалён"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при удалении часового пояса"
 */

/**
 * @swagger
 * /chat/upload:
 *   post:
 *     summary: "Загрузить файл для чата"
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               chatId:
 *                 type: string
 *     responses:
 *       200:
 *         description: "Файл загружен"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileUploadResponse'
 *       400:
 *         description: "Неверный тип файла"
 *       401:
 *         description: "Не авторизован"
 *       403:
 *         description: "Доступ запрещен"
 *       500:
 *         description: "Ошибка при загрузке файла"
 */