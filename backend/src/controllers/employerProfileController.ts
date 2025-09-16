import { AuthRequest } from "../middleware/authMiddleware.js";
import { Response } from "express";
import { prisma } from "../prismaClient.js";
import { ResponseStatus } from '@prisma/client';

export const createEmployerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      companyName,
      industry,
      contactName,
      phone,
      email,
      description,
      legalInfo,
      logoUrl,
    } = req.body;

    const exists = await prisma.employerProfile.findUnique({ where: { userId } });
    if (exists) {
      return res.status(400).json({ error: "Profile already exists" });
    }

    const profile = await prisma.employerProfile.create({
      data: {
        userId,
        companyName,
        industry,
        contactName,
        phone,
        email,
        description,
        legalInfo,
        logoUrl: logoUrl ?? null,
      },
    });

    return res.status(201).json({ message: "Профиль работодателя создан", profile });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export const getEmployerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const profile = await prisma.employerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },    
    });
    if (!profile) {
      return res.status(404).json({ error: "Профиль работодателя не найден" });
    }

    return res.json({ profile });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

export const updateEmployerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      companyName,
      industry,
      contactName,
      phone,
      email,
      description,
      legalInfo,
      logoUrl,
    } = req.body;

    const profile = await prisma.employerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ error: "Профиль работодателя не найден" });
    }

    const updatedProfile = await prisma.employerProfile.update({
      where: { userId },
      data: {
        companyName: companyName ?? profile.companyName,
        industry: industry ?? profile.industry,
        contactName: contactName ?? profile.contactName,
        phone: phone ?? profile.phone,
        email: email ?? profile.email,
        description: description ?? profile.description,
        legalInfo: legalInfo ?? profile.legalInfo,
        logoUrl: logoUrl ?? profile.logoUrl,
      },
    });

    return res.json({ message: "Профиль работодателя обновлён", profile: updatedProfile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export const deleteEmployerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Проверяем, существует ли профиль
    const profile = await prisma.employerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({ error: "Профиль работодателя не найден" });
    }

    // Удаляем профиль
    await prisma.employerProfile.delete({
      where: { userId },
    });

    return res.json({ message: "Профиль работодателя удалён" });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

// GET /vacancy/:id/candidates
export const getCandidatesForVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Ограничиваем лимит

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Получаем вакансию с дополнительной информацией для лучшего подбора
    const vacancy = await prisma.vacancy.findUnique({
      where: { id },
      include: { employer: true },
    });

    if (!vacancy) return res.status(404).json({ error: "Vacancy not found" });
    if (vacancy.employer.userId !== userId) {
      return res.status(403).json({ error: "Not your vacancy" });
    }

    // Кандидаты, которые уже откликались
    const respondedUserIds = await prisma.response.findMany({
      where: { vacancyId: id },
      select: { userId: true },
    });

    const excludedIds = respondedUserIds.map((r) => r.userId);
    
    // Более гибкие условия поиска
    const whereConditions: any = {
      userId: { notIn: excludedIds.length > 0 ? excludedIds : undefined },
      OR: [
        { desiredRole: { contains: vacancy.title, mode: 'insensitive' } },
        { skills: { hasSome: vacancy.title.split(' ') } }, // Ищем по навыкам, если в title есть ключевые слова
      ]
    };

    // Добавляем фильтр по часовому поясу, если он указан
    if (vacancy.timezone) {
      whereConditions.timezones = { has: vacancy.timezone };
    }

    const [candidates, totalCount] = await Promise.all([
      // Основной запрос кандидатов
      prisma.candidateProfile.findMany({
        where: whereConditions,
        select: {
          id: true,
          fullName: true,
          desiredRole: true,
          city: true,
          skills: true,
          userId: true,
          photoUrl: true, // Добавим фото для карточки
          experience: true, // Добавим опыт для лучшего отображения
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Сортировка по дате создания
      }),
      // Получаем общее количество для пагинации
      prisma.candidateProfile.count({
        where: whereConditions,
      })
    ]);

    res.json({
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: page * limit < totalCount,
      candidates
    });
  } catch (err) {
    console.error("Error in getCandidatesForVacancy:", err);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
};

// POST /vacancy/:id/candidates/:candidateId/action
export const candidateAction = async (req: AuthRequest, res: Response) => {
  try {
    const { id, candidateId } = req.params;
    const { action } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!id || !candidateId || !action) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    // Используем транзакцию для обеспечения целостности данных
    const result = await prisma.$transaction(async (tx) => {
      const vacancy = await tx.vacancy.findUnique({
        where: { id },
        include: { employer: true },
      });
      if (!vacancy) throw new Error("Vacancy not found");
      if (vacancy.employer.userId !== userId) throw new Error("Not your vacancy");

      const candidate = await tx.candidateProfile.findUnique({ 
        where: { userId: candidateId },
        include: { user: true }
      });
      if (!candidate) throw new Error("Candidate not found");

      // Ищем или создаём отклик
      let response = await tx.response.findFirst({
        where: { 
          vacancyId: id, 
          userId: candidate.userId 
        },
      });

      if (!response) {
        response = await tx.response.create({
          data: {
            vacancyId: id,
            userId: candidate.userId,
            status: "IN_PROGRESS",
            statusHistory: { 
              create: { status: "IN_PROGRESS" } 
            },
          },
        });
      }

      // Определяем новый статус и шаблон сообщения
      let newStatus: ResponseStatus;
      let template: string | null = null;

      switch (action) {
        case "INVITE":
          newStatus = "ACCEPTED";
          template = `Здравствуйте, ${candidate.fullName}! Мы приглашаем вас на вакансию "${vacancy.title}".`;
          break;
        case "REJECT":
          newStatus = "REJECTED";
          template = `Здравствуйте, ${candidate.fullName}. К сожалению, мы не можем пригласить вас на вакансию "${vacancy.title}".`;
          break;
        case "FAVORITE":
        // Проверяем текущий статус
        if (response.status === "FAVORITE") {
          // Если уже в избранном - убираем
          newStatus = "IN_PROGRESS";
        } else {
          // Если не в избранном - добавляем
          newStatus = "FAVORITE";
        }
        break;
        default:
          throw new Error("Unknown action");
      }

      // Обновляем статус
      await tx.response.update({
        where: { id: response.id },
        data: {
          status: newStatus,
          statusHistory: { create: { status: newStatus } },
        },
      });

      // Создаём чат и сообщение, если нужно
      if (template) {
        // Правильный поиск чата между двумя пользователями
        const existingChat = await tx.chat.findFirst({
          where: {
            AND: [
              { participants: { some: { userId: userId } } },
              { participants: { some: { userId: candidate.userId } } }
            ]
          },
          include: {
            participants: true
          }
        });

        let chat = existingChat;

        if (!chat) {
          // Создаём чат и включаем участников в возвращаемый объект
          chat = await tx.chat.create({
            data: {
              participants: {
                create: [
                  { userId: userId, role: "EMPLOYER" },
                  { userId: candidate.userId, role: "CANDIDATE" },
                ],
              },
            },
            include: {
              participants: true
            }
          });
        }

        await tx.message.create({
          data: {
            chatId: chat.id,
            senderId: userId,
            text: template,
          },
        });

        // Обновляем время обновления чата
        await tx.chat.update({
          where: { id: chat.id },
          data: { updatedAt: new Date() },
        });
      }

      return { message: "Action applied", status: newStatus };
    });

    res.json(result);
  } catch (err: any) {
    console.error("Error in candidateAction:", err);
    
    if (err.message === "Vacancy not found") {
      return res.status(404).json({ error: "Vacancy not found" });
    } else if (err.message === "Not your vacancy") {
      return res.status(403).json({ error: "Not your vacancy" });
    } else if (err.message === "Candidate not found") {
      return res.status(404).json({ error: "Candidate not found" });
    } else if (err.message === "Unknown action") {
      return res.status(400).json({ error: "Unknown action" });
    }
    
    res.status(500).json({ error: "Failed to apply action" });
  }
};

// GET /candidate/:id
export const getCandidateProfileById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const candidate = await prisma.candidateProfile.findUnique({
      where: { userId: id },
      include: { user: { select: { email: true, phone: true } } },
    });
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    res.json(candidate);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch candidate profile" });
  }
};


/**
 * @swagger
 * tags:
 *   - name: EmployerProfile
 *     description: "Управление профилем работодателя и операции с кандидатами"
 *
 * components:
 *   schemas:
 *     EmployerProfileInput:
 *       type: object
 *       required:
 *         - companyName
 *       properties:
 *         companyName:
 *           type: string
 *           example: "Acme Ltd."
 *         industry:
 *           type: string
 *           example: "IT"
 *         contactName:
 *           type: string
 *           example: "Иван Иванов"
 *         phone:
 *           type: string
 *           example: "+996700000000"
 *         email:
 *           type: string
 *           example: "hr@acme.com"
 *         description:
 *           type: string
 *         legalInfo:
 *           type: string
 *         logoUrl:
 *           type: string
 *
 *     EmployerProfileResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         companyName:
 *           type: string
 *         industry:
 *           type: string
 *         contactName:
 *           type: string
 *         phone:
 *           type: string
 *         email:
 *           type: string
 *         description:
 *           type: string
 *         legalInfo:
 *           type: string
 *         logoUrl:
 *           type: string
 *
 *     VacancyCandidateSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         fullName:
 *           type: string
 *         desiredRole:
 *           type: string
 *         city:
 *           type: string
 *         skills:
 *           type: array
 *           items:
 *             type: string
 *         userId:
 *           type: string
 *         photoUrl:
 *           type: string
 *         experience:
 *           type: string
 *
 *     CandidateListResponse:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         totalCount:
 *           type: integer
 *         totalPages:
 *           type: integer
 *         hasMore:
 *           type: boolean
 *         candidates:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/VacancyCandidateSummary'
 *
 *     CandidateActionInput:
 *       type: object
 *       required:
 *         - action
 *       properties:
 *         action:
 *           type: string
 *           description: "Действие: INVITE | REJECT | FAVORITE"
 *           example: "INVITE"
 *
 *     ActionResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         status:
 *           type: string
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *
 */

/**
 * @swagger
 * /employer/profile:
 *   post:
 *     summary: "Создать профиль работодателя"
 *     tags: [EmployerProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployerProfileInput'
 *     responses:
 *       201:
 *         description: "Профиль работодателя создан"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/EmployerProfileResponse'
 *       400:
 *         description: "Профиль уже существует или неверные данные"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: "Unauthorized"
 *       500:
 *         description: "Ошибка сервера"
 *
 *   get:
 *     summary: "Получить профиль работодателя текущего пользователя"
 *     tags: [EmployerProfile]
 *     responses:
 *       200:
 *         description: "Профиль работодателя"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   $ref: '#/components/schemas/EmployerProfileResponse'
 *       401:
 *         description: "Unauthorized"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: "Профиль работодателя не найден"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   put:
 *     summary: "Обновить профиль работодателя (только владелец)"
 *     tags: [EmployerProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployerProfileInput'
 *     responses:
 *       200:
 *         description: "Профиль работодателя обновлён"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/EmployerProfileResponse'
 *       401:
 *         description: "Unauthorized"
 *       404:
 *         description: "Профиль не найден"
 *       500:
 *         description: "Ошибка сервера"
 *
 *   delete:
 *     summary: "Удалить профиль работодателя"
 *     tags: [EmployerProfile]
 *     responses:
 *       200:
 *         description: "Профиль работодателя удалён"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: "Unauthorized"
 *       404:
 *         description: "Профиль не найден"
 *       500:
 *         description: "Ошибка сервера"
 */

/**
 * @swagger
 * /vacancy/{id}/candidates:
 *   get:
 *     summary: "Получить список подходящих кандидатов для вакансии (владелец вакансии)"
 *     tags: [EmployerProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID вакансии"
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *         description: "Номер страницы"
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: "Лимит на страницу (max 50)"
 *     responses:
 *       200:
 *         description: "Список кандидатов с пагинацией"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidateListResponse'
 *       401:
 *         description: "Unauthorized"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: "Not your vacancy"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: "Vacancy not found"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: "Ошибка сервера"
 */

/**
 * @swagger
 * /vacancy/{id}/candidates/{candidateId}/action:
 *   post:
 *     summary: "Применить действие к кандидату на вакансии (INVITE | REJECT | FAVORITE)"
 *     tags: [EmployerProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID вакансии"
 *       - in: path
 *         name: candidateId
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID пользователя-кандидата (userId)"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CandidateActionInput'
 *     responses:
 *       200:
 *         description: "Действие применено"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActionResponse'
 *       400:
 *         description: "Missing parameters / Unknown action"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: "Unauthorized"
 *       403:
 *         description: "Not your vacancy"
 *       404:
 *         description: "Vacancy or candidate not found"
 *       500:
 *         description: "Ошибка сервера"
 */

/**
 * @swagger
 * /candidate/{id}:
 *   get:
 *     summary: "Получить профиль кандидата по userId (публичный/для работодателя)"
 *     tags: [EmployerProfile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "userId кандидата"
 *     responses:
 *       200:
 *         description: "Профиль кандидата"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 desiredRole:
 *                   type: string
 *                 city:
 *                   type: string
 *                 skills:
 *                   type: array
 *                   items:
 *                     type: string
 *                 experience:
 *                   type: string
 *                 photoUrl:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *       404:
 *         description: "Candidate not found"
 *       500:
 *         description: "Ошибка сервера"
 */
