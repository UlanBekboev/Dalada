import { Response } from 'express';
import { prisma } from '../prismaClient.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

export const createVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const employer = await prisma.employerProfile.findUnique({ where: { userId } });
    if (!employer) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    const data = req.body;
    const vacancy = await prisma.vacancy.create({
      data: {
        employerId: employer.id,
        title: data.title,
        city: data.city,
        salaryFrom: data.salaryFrom,
        salaryTo: data.salaryTo,
        currency: data.currency,
        schedule: data.schedule,
        experienceFrom: data.experienceFrom,
        experienceTo: data.experienceTo,
        description: data.description,
        timezone: data.timezone,
        employmentType: data.employmentType,
        location: data.location,
        phone: data.phone,
        email: data.email,
        messenger: data.messenger,
        hidePhone: data.hidePhone ?? false,
        hideEmail: data.hideEmail ?? false,
        status: 'DRAFT', // при создании всегда черновик
      },
    });

    return res.status(201).json({ message: 'Вакансия создана (черновик)', vacancy });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка при создании вакансии', error: error.message });
  }
};

export const updateVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Не Авторизован' });
    }

    const employer = await prisma.employerProfile.findUnique({ where: { userId } });
    if (!employer) {
      if (!employer) return res.status(403).json({ message: 'Доступ только для работодателя' });
    }

    const vacancy = await prisma.vacancy.findUnique({ where: { id: req.params.id } });
    if (!vacancy || vacancy.employerId !== employer.id) return res.status(404).json({ message: 'Вакансия не найдена' });

    const updated = await prisma.vacancy.update({
      where: { id: vacancy.id },
      data: req.body,
    });

    return res.status(200).json({ message: 'Вакансия обновлена', updated });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка при обновлении вакансии', error: error.message });
  }
};

export const publishVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const employer = await prisma.employerProfile.findUnique({ where: { userId } });
    if (!employer) {
      if (!employer) return res.status(403).json({ message: 'Доступ только для работодателя' });
    }

    const vacancy = await prisma.vacancy.findUnique({ where: { id: req.params.id } });
    if (!vacancy || vacancy.employerId !== employer.id) {
      return res.status(404).json({ message: 'Вакансия не найдена или у вас нет прав на ее публикацию' });
    }

    const published = await prisma.vacancy.update({
      where: { id: vacancy.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    return res.status(200).json({ message: 'Вакансия опубликована', published });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка при публикации вакансии', error: error.message });
  }
};

export const deleteVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vacancy = await prisma.vacancy.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Вакансия удалена', vacancy });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка при удалении вакансии', error: error.message });
  }
};

export const getVacancyById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vacancy = await prisma.vacancy.update({
      where: { id },
      data: { views: { increment: 1 } },
      include: {
        employer: {
          select: {
            companyName: true,
            logoUrl: true,
          },
        },
      },
    });

    res.json(vacancy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vacancy' });
  }
};

export const respondToVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // vacancyId
    const userId = req.user?.userId; // из JWT
    const { coverLetter, resumes } = req.body;
    if (!id) {
      return res.status(400).json({ error: "vacancyId is required" });
    }
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user?.role !== 'CANDIDATE') {
      return res.status(403).json({ error: 'Доступ только для кандидатов' });
    }

    // проверяем, опубликована ли вакансия
    const vacancy = await prisma.vacancy.findUnique({ where: { id } });
    if (!vacancy || vacancy.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Vacancy not found or not published' });
    }

    // Проверка: не откликался ли пользователь ранее
    const existing = await prisma.response.findFirst({
      where: { vacancyId: id, userId },
    });
    if (existing) {
      return res.status(400).json({ error: 'Вы уже откликались на эту вакансию' });
    }

    // валидация резюме (PDF/DOC/DOCX, размер проверяется при загрузке на сервер)
    if (resumes && Array.isArray(resumes)) {
      const allowedExtensions = ['pdf', 'doc', 'docx'];
      for (const url of resumes) {
        const lower = url.toLowerCase();
        if (!allowedExtensions.some((ext) => lower.endsWith(ext))) {
          return res.status(400).json({ error: 'Резюме должно быть в PDF или Word' });
        }
      }
    }
    // 1. Сохраняем отклик
    await prisma.$transaction([
  prisma.response.create({
    data: {
      vacancyId: id, 
      userId,
      coverLetter: coverLetter || null,
      resumeUrls: resumes || [],
      status: 'IN_PROGRESS',
      statusHistory: {
        create: { status: 'IN_PROGRESS' }
      }
    },
  }),
  prisma.vacancy.update({
    where: { id },
    data: { responsesCount: { increment: 1 } },
  }),
]);

const createdResponse = await prisma.response.findFirst({
  where: { userId, vacancyId: id }
});
console.log("Created response:", createdResponse);

    res.json({ message: 'Отклик отправлен!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to respond to vacancy' });
  }
};

// export const getMyResponses = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.userId;

//     const responses = await prisma.response.findMany({
//       where: { userId },
//       include: { vacancy: true }, // подтянуть инфо о вакансии
//     });

//     res.json(responses);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch responses' });
//   }
// };
//Для работодателя (откликнувшиеся на вакансию)
export const getVacancyResponses = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // vacancyId

    const responses = await prisma.response.findMany({
      where: { vacancyId: id },
      include: { user: true }, // подтянуть инфо о кандидате
    });

    res.json(responses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vacancy responses' });
  }
};

export const getVacancies = async (req: AuthRequest, res: Response) => {
  try {
    const {
      q,
      titles, // список должностей
      cities, // список городов
      salaryFrom,
      salaryTo,
      schedules, // массив графиков
      experienceFrom,
      experienceTo,
      sort, // recommended | new | popular
    } = req.query;

    const where: any = {
      status: 'PUBLISHED',
    };

    if (q && typeof q === 'string')
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { employer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];

    //Фильтры
    if (titles) {
      const arr = Array.isArray(titles) ? titles : [titles];
      where.title = { in: arr };
    }

    if (cities) {
      const arr = Array.isArray(cities) ? cities : [cities];
      where.city = { in: arr };
    }

    if (salaryFrom || salaryTo) {
      where.AND = [
        salaryFrom ? { salaryTo: { gte: Number(salaryFrom) } } : {},
        salaryTo ? { salaryFrom: { gte: Number(salaryTo) } } : {},
      ];
    }

    if (schedules) {
      const arr = Array.isArray(schedules) ? schedules : [schedules];
      where.schedule = { in: arr };
    }

    if (experienceFrom || experienceTo) {
      where.AND = [
        experienceFrom ? { experienceTo: { gte: Number(experienceFrom) } } : {},
        experienceTo ? { experienceFrom: { gte: Number(experienceTo) } } : {},
      ];
    }

    // Сортировки
    let orderBy: any = { createdAt: 'desc' }; // по умолчанию новые

    if (sort === 'new') {
      orderBy = { createdAt: 'desc' };
    } else if (sort === 'popular') {
      orderBy = { views: 'desc' };
    } else if (sort === 'recommended') {
      orderBy = { views: 'desc' };
    }

    const vacancies = await prisma.vacancy.findMany({
      where,
      orderBy,
      include: {
        employer: { select: { companyName: true, logoUrl: true } },
      },
    });

    res.json(vacancies);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка при получении вакансии', error: error.message });
  }
};

export const getVacancyDescriptionById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const vacancy = await prisma.vacancy.findUnique({
      where: { id },
      include: {
        employer: { select: { companyName: true, logoUrl: true } },
        responses: userId
          ? { where: { userId }, select: { id: true } } // проверяем отклик
          : false,
      },
    });

    if (!vacancy) {
      return res.status(404).json({ error: 'Vacancy not found' });
    }

    res.json({
      id: vacancy.id,
      title: vacancy.title,
      company: vacancy.employer.companyName,
      city: vacancy.city,
      schedule: vacancy.schedule,
      experienceFrom: vacancy.experienceFrom,
      experienceTo: vacancy.experienceTo,
      salaryFrom: vacancy.salaryFrom,
      salaryTo: vacancy.salaryTo,
      currency: vacancy.currency,
      description: vacancy.description,
      contacts: {
        phone: vacancy.hidePhone ? null : vacancy.phone,
        email: vacancy.hideEmail ? null : vacancy.email,
        messenger: vacancy.messenger,
      },
      alreadyResponded: vacancy.responses.length > 0, // флаг для фронта
      publishedAt: vacancy.publishedAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vacancy' });
  }
};

