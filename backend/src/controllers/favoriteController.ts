import { Request, Response } from 'express';
import { prisma } from '../prismaClient.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

// Вспомогательная функция для проверки типа ошибки Prisma
function isPrismaError(error: unknown): error is { code: string; meta?: unknown } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const toggleFavoriteVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const { vacancyId } = req.params;
    const candidateUserId = req.user?.userId;

    // 1. Валидация и авторизация
    if (!candidateUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user?.role !== 'CANDIDATE') {
      return res.status(403).json({ error: 'Only candidates can favorite vacancies' });
    }
    if (!vacancyId) {
      return res.status(400).json({ error: 'Vacancy ID is required' });
    }

    // 2. Проверка существования и статуса вакансии
    const vacancy = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
      select: { id: true, status: true },
    });

    if (!vacancy) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }
    if (vacancy.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Cannot favorite an unpublished vacancy' });
    }

    // 3. Поиск существующего избранного (используем правильный составной ключ)
    const existingFavorite = await prisma.candidateFavoriteVacancy.findUnique({
      where: {
        // Убедитесь, что это имя соответствует имени в вашей схеме Prisma @@unique([vacancyId, candidateUserId])
        vacancyId_candidateUserId: {
          vacancyId,
          candidateUserId,
        },
      },
    });

    // 4. Toggle логика
    if (existingFavorite) {
      // Удаляем существующее избранное
      try {
        await prisma.candidateFavoriteVacancy.delete({
          where: { id: existingFavorite.id },
        });
        return res.json({
          message: 'Removed from favorites',
          favorited: false,
        });
      } catch (deleteError) {
        // Обрабатываем ошибку, если запись уже удалена
        if (isPrismaError(deleteError) && deleteError.code === 'P2025') {
          // Запись уже не существует, можно считать успехом
          return res.json({
            message: 'Removed from favorites',
            favorited: false,
          });
        }
        throw deleteError; // Пробрасываем другие ошибки
      }
    } else {
      // Создаем новую запись в избранном
      try {
        await prisma.candidateFavoriteVacancy.create({
          data: {
            vacancyId,
            candidateUserId,
          },
        });
        return res.json({
          message: 'Added to favorites',
          favorited: true,
        });
      } catch (createError) {
        // Обрабатываем ошибку уникальности (параллельный запрос)
        if (isPrismaError(createError) && createError.code === 'P2002') {
          // Дубликат создан другим запросом, можно считать успехом
          return res.json({
            message: 'Added to favorites',
            favorited: true,
          });
        }
        throw createError; // Пробрасываем другие ошибки
      }
    }
  } catch (err) {
    console.error('Error in toggleFavoriteVacancy:', err);
    res.status(500).json({
      error: 'Internal server error',
      // В продакшне не возвращайте детали ошибок клиенту
    });
  }
};

export const getMyFavoriteVacancies = async (req: AuthRequest, res: Response) => {
  try {
    const candidateUserId = req.user?.userId;

    // Проверка авторизации и прав
    if (!candidateUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user?.role !== 'CANDIDATE') {
      return res.status(403).json({ error: 'Only candidates can access favorites' });
    }

    // Пагинация
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Основной запрос с правильной фильтрацией
    const [favoriteRecords, totalCount] = await Promise.all([
      // Получаем записи избранного с JOIN к вакансиям
      prisma.candidateFavoriteVacancy.findMany({
        where: {
          candidateUserId,
          vacancy: {
            status: 'PUBLISHED', // Фильтруем только опубликованные вакансии
          },
        },
        include: {
          vacancy: {
            select: {
              id: true,
              title: true,
              city: true,
              salaryFrom: true,
              salaryTo: true,
              currency: true,
              employer: {
                select: {
                  companyName: true,
                  logoUrl: true,
                },
              },
              status: true,
              publishedAt: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      // Считаем общее количество
      prisma.candidateFavoriteVacancy.count({
        where: {
          candidateUserId,
          vacancy: {
            status: 'PUBLISHED',
          },
        },
      }),
    ]);

    // Форматируем ответ
    const favorites = favoriteRecords.map((record) => ({
      favoriteId: record.id,
      vacancy: record.vacancy,
      favoritedAt: record.createdAt,
    }));

    res.json({
      favorites,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error('getMyFavoriteVacancies error:', err);
    res.status(500).json({ error: 'Failed to fetch favorite vacancies' });
  }
};

// for employer
// PATCH /api/vacancy/:vacancyId/candidates/:candidateId/favorite
export const toggleFavoriteCandidate = async (req: AuthRequest, res: Response) => {
  try {
    const { vacancyId, candidateProfileId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!vacancyId) {
      return res.status(400).json({ error: 'Vacancy ID is required' });
    }

    if (!candidateProfileId) {
      return res.status(400).json({ error: 'Candidate ID is required' });
    }

    // Используем транзакцию для обеспечения целостности данных
    const result = await prisma.$transaction(async (tx) => {
      // Проверяем, что вакансия принадлежит текущему работодателю
      const vacancy = await tx.vacancy.findUnique({
        where: { id: vacancyId },
        include: {
          employer: true
        },
      });

      if (!vacancy) {
        throw new Error('Vacancy not found');
      }

      // Проверяем, что текущий пользователь является владельцем вакансии
      if (vacancy.employer.userId !== userId) {
        throw new Error('Access denied: not your vacancy');
      }

      // Проверяем существование кандидата
      const candidateProfile = await tx.candidateProfile.findUnique({
        where: { userId: candidateProfileId },                           // тут может быть id, а не userId
        include: { user: true }
      });

      if (!candidateProfile || !candidateProfile.user) {
        throw new Error('Candidate not found');
      }

      const candidateUserId = candidateProfile.user.id;
      // Находим или создаем отклик от кандидата
      let response = await tx.response.findFirst({
        where: { 
          vacancyId, 
          userId: candidateUserId 
        },
      });

      if (!response) {
        // Создаем новый отклик со статусом FAVORITE
        response = await tx.response.create({
          data: {
            vacancyId,
            userId: candidateUserId,
            status: 'FAVORITE',
            statusHistory: {
              create: { status: 'FAVORITE' }
            }
          },
        });
        
        return { 
          message: 'Added to favorites', 
          status: 'FAVORITE' 
        };
      }

      // Переключаем статус
      const newStatus = response.status === 'FAVORITE' ? 'IN_PROGRESS' : 'FAVORITE';

      // Обновляем статус отклика
      await tx.response.update({
        where: { id: response.id },
        data: { 
          status: newStatus,
          statusHistory: {
            create: { status: newStatus }
          }
        },
      });

      return {
        message: newStatus === 'FAVORITE' ? 'Added to favorites' : 'Removed from favorites',
        status: newStatus,
      };
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error in toggleFavorite:', err);
    
    // Обрабатываем различные типы ошибок
    if (err.message === 'Vacancy not found') {
      return res.status(404).json({ error: 'Vacancy not found' });
    } else if (err.message === 'Access denied: not your vacancy') {
      return res.status(403).json({ error: 'Access denied: not your vacancy' });
    } else if (err.message === 'Candidate not found') {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
};

export const getFavoriteCandidates = async (req: AuthRequest, res: Response) => {
  try {
    const { vacancyId } = req.params;
    const employerUserId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!employerUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Проверяем, что вакансия существует и принадлежит этому работодателю
    const vacancy = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
      include: { employer: true },
    });

    if (!vacancy) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    if (vacancy.employer.userId !== employerUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Получаем избранных кандидатов
    const [favoriteResponses, totalCount] = await Promise.all([
      prisma.response.findMany({
        where: {
          vacancyId,
          status: 'FAVORITE', // используем именно FAVORITE
        },
        include: {
          user: {
            include: {
              candidateProfile: {
                include: {
                  languages: true,
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.response.count({
        where: {
          vacancyId,
          status: 'FAVORITE',
        },
      }),
    ]);

    // Формируем ответ
    const favorites = favoriteResponses
      .map((response) => {
        const profile = response.user.candidateProfile;
        if (!profile) return null;

        return {
          id: profile.id,
          userId: response.userId,
          fullName: profile.fullName,
          desiredRole: profile.desiredRole,
          city: profile.city,
          skills: profile.skills,
          photoUrl: profile.photoUrl,
          responseId: response.id,
          responseStatus: response.status,
          respondedAt: response.createdAt,
        };
      })
      .filter((p) => p !== null);

    res.json({
      favorites,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error('Error in getFavoriteCandidates:', err);
    res.status(500).json({ error: 'Failed to fetch favorite candidates' });
  }
};
