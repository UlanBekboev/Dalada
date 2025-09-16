import { Response } from 'express';
import { prisma } from '../prismaClient.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { Prisma, PrismaClient } from "@prisma/client";
import { validateAvailability } from '../validation/candidateValidation.js';

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
      resumeUrl, certificateUrls, videoUrl, photoUrl,
      timezone, anytime, intervals
    } = req.body;

    if (!timezone) return res.status(422).json({ message: 'timezone required' });

    validateAvailability(anytime, timezone, intervals);

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
        certificateUrls: Array.isArray(certificateUrls) ? certificateUrls.filter(url => typeof url === 'string') : [],
        videoUrl: videoUrl ?? null,
        timezone,
        anytime,
      },
    });

    // сохраним availability
    if (!anytime && intervals?.length) {
      await prisma.candidateAvailability.createMany({
        data: intervals.map((i: any) => ({
          candidateId: profile.id,
          dayOfWeek: i.dayOfWeek,
          start: i.start,
          end: i.end,
        })),
      });
    }

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
      include: { languages: true, availability: true },
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
      resumeUrl, certificateUrls, videoUrl, photoUrl, timezone, anytime, intervals
     } =
      req.body;

    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: 'Профиль не найден' });

    const langs = parseLanguages(languages);

    if (!timezone && profile.timezone == null) {
      return res.status(422).json({ message: 'timezone required' });
    }

    validateAvailability(anytime ?? profile.anytime, timezone ?? profile.timezone, intervals);

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          timezone: timezone ?? profile.timezone,
          anytime: anytime ?? profile.anytime,
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

      await tx.candidateAvailability.deleteMany({ where: { candidateId: p.id } });
      if (!(anytime ?? profile.anytime) && intervals?.length) {
        await tx.candidateAvailability.createMany({
          data: intervals.map((i: any) => ({
            candidateId: p.id,
            dayOfWeek: i.dayOfWeek,
            start: i.start,
            end: i.end,
          })),
        });
      }

      return tx.candidateProfile.findUnique({
        where: { id: p.id },
        include: { languages: true, availability: true },
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
      include: { languages: true, availability: true },
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
      prisma.candidateAvailability.deleteMany({ where: { candidateId: profile.id } }),
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

/**
 * @swagger
 * tags:
 *   - name: CandidateProfile
 *     description: "Управление профилем соискателя (CRUD + языки + availability)"
 *
 * components:
 *   schemas:
 *     AvailabilityInterval:
 *       type: object
 *       required:
 *         - dayOfWeek
 *         - start
 *         - end
 *       properties:
 *         dayOfWeek:
 *           type: integer
 *           description: "0 = Sunday, 1 = Monday ... 6 = Saturday"
 *           example: 1
 *         start:
 *           type: string
 *           description: "Время начала в формате HH:MM (24h)"
 *           example: "09:00"
 *         end:
 *           type: string
 *           description: "Время окончания в формате HH:MM. Если end < start — смена через полночь."
 *           example: "18:00"
 *
 *     CandidateProfileInput:
 *       type: object
 *       required:
 *         - fullName
 *         - timezone
 *       properties:
 *         fullName:
 *           type: string
 *           example: "Улан Б."
 *         age:
 *           type: integer
 *           example: 28
 *         city:
 *           type: string
 *         country:
 *           type: string
 *         experience:
 *           type: string
 *         skills:
 *           type: array
 *           items:
 *             type: string
 *           example: ["nodejs","typescript"]
 *         education:
 *           type: string
 *         desiredRole:
 *           type: string
 *         salary:
 *           type: integer
 *         timezones:
 *           type: array
 *           items:
 *             type: string
 *           description: "Список подходящих часовых поясов (опционально)"
 *         languages:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               language:
 *                 type: string
 *               level:
 *                 type: string
 *                 example: B2
 *         resumeUrl:
 *           type: string
 *         certificateUrls:
 *           type: array
 *           items:
 *             type: string
 *         videoUrl:
 *           type: string
 *         photoUrl:
 *           type: string
 *
 *         timezone:
 *           type: string
 *           description: "Базовый часовой пояс, обязательное поле для availability (например, 'UTC+5')"
 *         anytime:
 *           type: boolean
 *           description: "true — 'В любое время'"
 *         intervals:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AvailabilityInterval'
 *           description: "Массив интервалов (требуется если anytime=false)"
 *
 *     CandidateProfileResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         fullName:
 *           type: string
 *         timezone:
 *           type: string
 *         anytime:
 *           type: boolean
 *         availability:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AvailabilityInterval'
 *         languages:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               language:
 *                 type: string
 *               level:
 *                 type: string
 *     LanguageUpsertInput:
 *       type: object
 *       required:
 *         - language
 *         - level
 *       properties:
 *         language:
 *           type: string
 *           example: "English"
 *         level:
 *           type: string
 *           example: "B2"
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *
 */

/**
 * @swagger
 * /candidate/profile:
 *   post:
 *     summary: "Создать профиль соискателя (обязательные поля: fullName, timezone)"
 *     tags: [CandidateProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CandidateProfileInput'
 *     responses:
 *       201:
 *         description: "Профиль создан"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/CandidateProfileResponse'
 *       400:
 *         description: "Профиль уже существует / Bad request"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: "Ошибки валидации (timezone required, формат времени, лимиты, пересечения)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: "Ошибка сервера"
 */

/**
 * @swagger
 * /candidate/profile:
 *   put:
 *     summary: "Обновить профиль соискателя (включая availability). Только владелец профиля может изменить."
 *     tags: [CandidateProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CandidateProfileInput'
 *     responses:
 *       200:
 *         description: "Профиль обновлён"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/CandidateProfileResponse'
 *       403:
 *         description: "Forbidden — попытка изменить чужой профиль"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: "Профиль не найден"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: "Ошибка валидации (формат времени, пересечения, лимиты, timezone required)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: "Ошибка сервера"
 */

/**
 * @swagger
 * /candidate/profile:
 *   get:
 *     summary: "Получить профиль текущего аутентифицированного соискателя (включая availability)"
 *     tags: [CandidateProfile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Профиль найден"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidateProfileResponse'
 *       401:
 *         description: "Не авторизован"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: "Профиль не найден"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /candidate/profile:
 *   delete:
 *     summary: "Удалить профиль соискателя (включая languages и availability)"
 *     tags: [CandidateProfile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Профиль удалён"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: "Не авторизован"
 *       404:
 *         description: "Профиль не найден"
 *       500:
 *         description: "Ошибка сервера"
 */

/**
 * @swagger
 * /candidate/languages:
 *   post:
 *     summary: "Добавить или обновить один язык (upsert)"
 *     tags: [CandidateProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LanguageUpsertInput'
 *     responses:
 *       200:
 *         description: "Язык сохранён"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 item:
 *                   type: object
 *       400:
 *         description: "language и level обязательны"
 *       401:
 *         description: "Не авторизован"
 *       404:
 *         description: "Профиль не найден"
 *       500:
 *         description: "Ошибка сервера"
 *
 * /candidate/languages/{language}:
 *   delete:
 *     summary: "Удалить один язык кандидата"
 *     tags: [CandidateProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: language
 *         required: true
 *         schema:
 *           type: string
 *         description: "Название языка (пример: English)"
 *     responses:
 *       200:
 *         description: "Язык удалён"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: "language обязателен"
 *       401:
 *         description: "Не авторизован"
 *       404:
 *         description: "Профиль или язык не найден"
 *       500:
 *         description: "Ошибка сервера"
 */
