import { Response } from 'express';
import { prisma } from '../prismaClient.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

// helper: нормализуем уровень под enum Prisma
const normalizeLevel = (val: any) => {
  if (!val) return undefined;
  const up = String(val).toUpperCase();
  // допустимые значения enum LanguageLevel: A1,A2,B1,B2,C1,C2,NATIVE
  const allowed = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE']);
  if (up === 'NATIVE' || up === 'NATIVE_SPEAKER') return 'NATIVE';
  return allowed.has(up) ? up : undefined;
};

// helper: попробуем распарсить languages, если это строка
const parseLanguages = (languages: any) => {
  if (!languages) return undefined;
  if (Array.isArray(languages)) return languages;
  if (typeof languages === 'string') {
    try {
      const parsed = JSON.parse(languages);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

// ---------- CREATE ----------
export const createCandidateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизован' });

    const {
      fullName,
      age,
      city,
      country,
      experience,
      skills,
      education,
      desiredRole,
      salary,
      timezones,
      languages,
      resumeUrl, certificateUrls, videoUrl, photoUrl
    } = req.body;

    const exists = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (exists) return res.status(400).json({ message: 'Профиль уже существует' });

    const profile = await prisma.candidateProfile.create({
      data: {
        userId,
        fullName,
        age,
        city,
        country,
        experience,
        skills,
        education,
        desiredRole,
        salary,
        timezones,
        photoUrl: photoUrl ?? null,
        resumeUrl: resumeUrl ?? null,
        certificateUrls: certificateUrls && Array.isArray(certificateUrls) ? certificateUrls : [],
        videoUrl: videoUrl ?? null,
      },
    });

    const langs = parseLanguages(languages);
    if (langs) {
      await prisma.candidateLanguage.createMany({
        data: langs.map((l: any) => ({
          candidateId: profile.id,
          language: l.language ?? l.name, // поддержка {name, level}
          level: normalizeLevel(l.level) as any,
        })),
        skipDuplicates: true,
      });
    }

    const full = await prisma.candidateProfile.findUnique({
      where: { id: profile.id },
      include: { languages: true },
    });

    return res.status(201).json({ message: 'Профиль создан', profile: full });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// ---------- UPDATE ----------
export const updateCandidateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизован' });

    const { fullName, age, city, country, experience, skills, education, desiredRole, salary, timezones, languages,
      resumeUrl, certificateUrls, videoUrl, photoUrl,
     } =
      req.body;

    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: 'Профиль не найден' });

    const langs = parseLanguages(languages);

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.candidateProfile.update({
        where: { userId },
        data: {
          fullName: fullName ?? profile.fullName,
          age: age ?? profile.age,
          city: city ?? profile.city,
          country: country ?? profile.country,
          experience: experience ?? profile.experience,
          skills: skills ?? profile.skills,
          education: education ?? profile.education,
          desiredRole: desiredRole ?? profile.desiredRole,
          salary: salary ?? profile.salary,
          timezones: timezones ?? profile.timezones,
          photoUrl: photoUrl ?? null,
          resumeUrl: resumeUrl ?? null,
          certificateUrls: certificateUrls && Array.isArray(certificateUrls) ? certificateUrls : [],
          videoUrl: videoUrl ?? null,
        },
      });

      if (Array.isArray(langs)) {
        await tx.candidateLanguage.deleteMany({ where: { candidateId: p.id } });
        if (langs.length) {
          await tx.candidateLanguage.createMany({
            data: langs.map((l: any) => ({
              candidateId: p.id,
              language: l.language ?? l.name,
              level: normalizeLevel(l.level) as any,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.candidateProfile.findUnique({
        where: { id: p.id },
        include: { languages: true },
      });
    });

    return res.json({ message: 'Профиль обновлён', profile: updated });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// ---------- GET ----------
export const getCandidateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизован' });

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { languages: true },
    });

    if (!profile) return res.status(404).json({ message: 'Профиль не найден' });

    return res.json(profile);
  } catch (error: any) {
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// ---------- DELETE PROFILE ----------
export const deleteCandidateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизован' });

    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: 'Профиль не найден' });

    await prisma.$transaction([
      prisma.candidateLanguage.deleteMany({ where: { candidateId: profile.id } }),
      prisma.candidateProfile.delete({ where: { userId } }),
    ]);

    return res.json({ message: 'Профиль кандидата удалён' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Добавить/обновить один язык
export const upsertCandidateLanguage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизован' });

    const { language, level } = req.body;
    if (!language || !level) return res.status(400).json({ message: 'language и level обязательны' });

    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: 'Профиль не найден' });

    // благодаря @@unique([candidateId, language]) можно upsert
    const saved = await prisma.candidateLanguage.upsert({
      where: { candidateId_language: { candidateId: profile.id, language } },
      create: { candidateId: profile.id, language, level: normalizeLevel(level) as any },
      update: { level: normalizeLevel(level) as any },
    });

    return res.json({ message: 'Язык сохранён', item: saved });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Ошибка сервера', error: e.message });
  }
};

// Удалить один язык
export const deleteCandidateLanguage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизован' });

    const lang = req.params.language; // DELETE /candidate/languages/English
    if (!lang) return res.status(400).json({ message: 'language обязателен' });

    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: 'Профиль не найден' });

    await prisma.candidateLanguage.delete({
      where: { candidateId_language: { candidateId: profile.id, language: lang } },
    });

    return res.json({ message: 'Язык удалён' });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Ошибка сервера', error: e.message });
  }
};
