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

// PATCH /api/vacancies/:vacancyId/candidates/:candidateId/favorite
// export const toggleFavorite = async (req: AuthRequest, res: Response) => {
//   try {
//     const { vacancyId, candidateId } = req.params;
//     const employerId = req.user?.userId;

//     if (!employerId) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     if (!vacancyId) {
//       return res.status(400).json({ error: "Vacancy ID is required" });
//     }

//     if (!candidateId) {
//       return res.status(400).json({ error: "Candidate ID is required" });
//     }

//     // Проверяем, что вакансия принадлежит текущему работодателю
//     const vacancy = await prisma.vacancy.findUnique({
//       where: { id: vacancyId },
//       select: { employerId: true },
//     });

//     if (!vacancy) {
//       return res.status(404).json({ error: "Vacancy not found" });
//     }

//     const employerProfile = await prisma.employerProfile.findUnique({
//       where: { userId: employerId },
//     });

//     if (!employerProfile || vacancy.employerId !== employerProfile.id) {
//       return res.status(403).json({ error: "Access denied: not your vacancy" });
//     }

//     // Находим или создаем отклик от кандидата
//     let response = await prisma.response.findFirst({
//       where: { vacancyId, userId: candidateId },
//     });

//     if (!response) {
//       response = await prisma.response.create({
//         data: {
//           vacancyId,
//           userId: candidateId,
//           status: "FAVORITE", // сразу ставим избранное
//         },
//       });
//       return res.json({ message: "Added to favorites", status: "FAVORITE" });
//     }

//     // Переключаем статус
//     const newStatus =
//       response.status === "FAVORITE" ? "IN_PROGRESS" : "FAVORITE";

//     await prisma.response.update({
//       where: { id: response.id },
//       data: { status: newStatus },
//     });

//     res.json({
//       message:
//         newStatus === "FAVORITE"
//           ? "Added to favorites"
//           : "Removed from favorites",
//       status: newStatus,
//     });
//   } catch (err) {
//     console.error("Error in toggleFavorite:", err);
//     res.status(500).json({ error: "Failed to toggle favorite" });
//   }
// };

// export const getFavoriteCandidates = async (req: AuthRequest, res: Response) => {
//   try {
//     const { vacancyId } = req.params;
//     const employerUserId = req.user?.userId;
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 10;

//     if (!employerUserId) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     // Проверяем, что вакансия существует и принадлежит этому работодателю
//     const vacancy = await prisma.vacancy.findUnique({
//       where: { id: vacancyId },
//       include: { employer: true },
//     });

//     if (!vacancy) {
//       return res.status(404).json({ error: "Vacancy not found" });
//     }

//     if (vacancy.employer.userId !== employerUserId) {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     // Получаем избранных кандидатов
//     const [favoriteResponses, totalCount] = await Promise.all([
//       prisma.response.findMany({
//         where: {
//           vacancyId,
//           status: "FAVORITE", // используем именно FAVORITE
//         },
//         include: {
//           user: {
//             include: {
//               candidateProfile: {
//                 include: {
//                   languages: true,
//                 },
//               },
//             },
//           },
//         },
//         skip: (page - 1) * limit,
//         take: limit,
//         orderBy: { createdAt: "desc" },
//       }),
//       prisma.response.count({
//         where: {
//           vacancyId,
//           status: "FAVORITE",
//         },
//       }),
//     ]);

//     // Формируем ответ
//     const favorites = favoriteResponses
//       .map((response) => {
//         const profile = response.user.candidateProfile;
//         if (!profile) return null;

//         return {
//           id: profile.id,
//           userId: response.userId,
//           fullName: profile.fullName,
//           desiredRole: profile.desiredRole,
//           city: profile.city,
//           skills: profile.skills,
//           photoUrl: profile.photoUrl,
//           responseId: response.id,
//           responseStatus: response.status,
//           respondedAt: response.createdAt,
//         };
//       })
//       .filter((p) => p !== null);

//     res.json({
//       favorites,
//       pagination: {
//         page,
//         limit,
//         totalCount,
//         totalPages: Math.ceil(totalCount / limit),
//       },
//     });
//   } catch (err) {
//     console.error("Error in getFavoriteCandidates:", err);
//     res.status(500).json({ error: "Failed to fetch favorite candidates" });
//   }
// };

// export const searchCandidates = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.userId;
//     const { skills, city, page = 1, limit = 10 } = req.query;
    
//     if (!userId) return res.status(401).json({ error: "Unauthorized" });

//     const pageNum = parseInt(page as string) || 1;
//     const limitNum = parseInt(limit as string) || 10;
//     const skip = (pageNum - 1) * limitNum;

//     // Формируем условия фильтрации
//     const whereConditions: any = {};

//     // Фильтр по городу
//     if (city) {
//       whereConditions.city = {
//         contains: city as string,
//         mode: 'insensitive'
//       };
//     }

//     // Фильтр по навыкам
//     if (skills) {
//       const skillsArray = (skills as string).split(',');
//       whereConditions.skills = {
//         hasSome: skillsArray
//       };
//     }

//     const [candidates, totalCount] = await Promise.all([
//       // Получаем кандидатов
//       prisma.candidateProfile.findMany({
//         where: whereConditions,
//         select: {
//           id: true,
//           fullName: true,
//           desiredRole: true,
//           city: true,
//           skills: true,
//           experience: true,
//           photoUrl: true,
//           userId: true,
//           languages: true,
//           user: {
//             select: {
//               email: true,
//               phone: true
//             }
//           }
//         },
//         skip,
//         take: limitNum,
//         orderBy: { createdAt: 'desc' }
//       }),
//       // Получаем общее количество
//       prisma.candidateProfile.count({
//         where: whereConditions
//       })
//     ]);

//     res.json({
//       candidates,
//       pagination: {
//         page: pageNum,
//         limit: limitNum,
//         totalCount,
//         totalPages: Math.ceil(totalCount / limitNum)
//       }
//     });
//   } catch (err) {
//     console.error("Error in searchCandidates:", err);
//     res.status(500).json({ error: "Failed to search candidates" });
//   }
// };
