import { Response } from "express";
import { prisma } from "../prismaClient.js";
import { AuthRequest } from "../middleware/authMiddleware.js";

export const uploadResume = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const { resumeUrl } = req.body;

      const profile = await prisma.candidateProfile.update({
        where: { userId },
        data: { resumeUrl }
      });

      return res.json({ message: "Резюме загружено", profile });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Ошибка при загрузке резюме", error: error.message })
    }
}

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

    const { logoUrl } = req.body;
    if (!logoUrl) return res.status(400).json({ message: "logoUrl is required" });

    const profile = await prisma.employerProfile.update({
      where: { userId },
      data: { logoUrl },
    });

    return res.json({ message: "Логотип загружен", profile });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Ошибка при загрузке логотипа", error: error.message });
  }
};

// Удаление логотипа
export const deleteEmployerLogo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const profile = await prisma.employerProfile.update({
      where: { userId },
      data: { logoUrl: null },
    });

    return res.json({ message: "Логотип удалён", profile });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Ошибка при удалении логотипа", error: error.message });
  }
};

export const uploadPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const { photoUrl } = req.body;
    if (!photoUrl) return res.status(400).json({ message: "photoUrl is required" });

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { photoUrl }
    });

    return res.json({ message: "Фото загружено", profile });
  } catch (error: any) {
    return res.status(500).json({ message: "Ошибка при загрузке фото", error: error.message });
  }
};

export const removePhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Не авторизован" });

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { photoUrl: null }
    });

    return res.json({ message: "Фото удалено", profile });
  } catch (error: any) {
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

