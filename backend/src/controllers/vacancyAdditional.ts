import { Response } from "express";
import { prisma } from "../prismaClient.js";
import { AuthRequest } from "../middleware/authMiddleware.js";

export const getMyRespondedVacancies = async (req: AuthRequest, res: Response) => {
  try {
    console.log("Function getMyRespondedVacancies started");
    const userId = req.user?.userId;
    console.log("User ID from request:", userId);

    if (!userId) {
      console.log("No user ID - unauthorized");
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("Querying database...");
    const responses = await prisma.response.findMany({
      where: { userId },
      include: {
        vacancy: {
          select: {
            id: true,
            title: true,
            city: true,
            salaryFrom: true,
            salaryTo: true,
            currency: true,
            employer: { select: { companyName: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("Found responses:", responses.length);
    
    const result = responses.map((r) => ({
      responseId: r.id,
      status: r.status,
      respondedAt: r.createdAt,
      vacancy: r.vacancy,
    }));

    console.log("Sending response");
    res.json(result);
  } catch (err: any) {
    console.error("Error in getMyRespondedVacancies:", err);
    res.status(500).json({ 
      error: "Ошибка при получении откликов", 
      details: err.message 
    });
  }
};

export const updateResponseStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // responseId
    const { status } = req.body; // новый статус
    const userId = req.user?.userId;

    if (!id) {
      return res.status(400).json({ error: "Chat ID is required" });
    }
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Находим отклик + вакансию + работодателя
    const response = await prisma.response.findUnique({
      where: { id },
      include: {
        vacancy: {
          include: { employer: true },
        },
        user: true, // кандидат
      },
    });

    if (!response) return res.status(404).json({ error: "Response not found" });

    // Проверка, что статус меняет именно владелец вакансии
    if (response.vacancy.employer.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Обновляем статус
    const updated = await prisma.response.update({
      where: { id },
      data: { status },
    });

    // Логируем историю
    await prisma.responseStatusHistory.create({
      data: { responseId: id, status },
    });

    // 🚀 Если статус ACCEPTED или REJECTED → создаём чат (если нет)
    if (status === "ACCEPTED" || status === "REJECTED") {
      const existingChat = await prisma.chat.findFirst({
        where: {
          participants: {
            some: { userId: response.userId },
          },
          AND: {
            participants: {
              some: { userId: response.vacancy.employer.userId },
            },
          },
        },
      });

      let chatId = existingChat?.id;

      if (!chatId) {
        const chat = await prisma.chat.create({
          data: {
            participants: {
              create: [
                { userId: response.userId, role: "CANDIDATE" },
                { userId: response.vacancy.employer.userId, role: "EMPLOYER" },
              ],
            },
          },
        });
        chatId = chat.id;

        // Шаблон сообщения
        const template =
          status === "ACCEPTED"
            ? "Здравствуйте! Мы приглашаем вас на собеседование."
            : "К сожалению, мы не можем продолжить сотрудничество.";

        await prisma.message.create({
          data: {
            chatId,
            senderId: userId,
            text: template,
          },
        });
      }
    }

    res.json({ message: "Response status updated", updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to update response status" });
  }
};

// export const startChat = async (req: AuthRequest, res: Response) => {
//   try {
//     const { candidateId, templateText } = req.body;
//     const userId = req.user?.userId;

//     if (!userId) return res.status(401).json({ error: "Unauthorized" });

//     // Проверим роли
//     const employer = await prisma.employerProfile.findUnique({
//       where: { userId },
//     });
//     if (!employer) return res.status(403).json({ error: "Only employer can start chat" });

//     // Проверим, есть ли уже чат
//     const existingChat = await prisma.chat.findFirst({
//       where: {
//         participants: {
//           some: { userId: candidateId },
//         },
//         AND: {
//           participants: {
//             some: { userId },
//           },
//         },
//       },
//     });

//     if (existingChat) return res.json({ chatId: existingChat.id });

//     // Создаём чат
//     const chat = await prisma.chat.create({
//       data: {
//         participants: {
//           create: [
//             { userId: candidateId, role: "CANDIDATE" },
//             { userId, role: "EMPLOYER" },
//           ],
//         },
//       },
//     });

//     // Первое сообщение (шаблон можно редактировать перед отправкой)
//     await prisma.message.create({
//       data: {
//         chatId: chat.id,
//         senderId: userId,
//         text: templateText || "Здравствуйте, хочу обсудить сотрудничество!",
//       },
//     });

//     res.json({ chatId: chat.id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to start chat" });
//   }
// };

// export const getMyChats = async (req: AuthRequest, res: Response) => {
//   try {
//     const userId = req.user?.userId;
//     if (!userId) return res.status(401).json({ error: "Unauthorized" });

//     const chats = await prisma.chat.findMany({
//       where: {
//         participants: { some: { userId } },
//       },
//       include: {
//         participants: {
//           include: { user: { select: { id: true, name: true, role: true } } },
//         },
//         messages: {
//           take: 1,
//           orderBy: { createdAt: "desc" }, // последнее сообщение
//         },
//       },
//       orderBy: { updatedAt: "desc" },
//     });

//     res.json(chats);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch chats" });
//   }
// };

// export const getChatMessages = async (req: AuthRequest, res: Response) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user?.userId;
//     if (!userId) return res.status(401).json({ error: "Unauthorized" });

//     // Проверка доступа
//     const participant = await prisma.chatParticipant.findFirst({
//       where: { chatId: id, userId },
//     });
//     if (!participant) return res.status(403).json({ error: "Access denied" });

//     const messages = await prisma.message.findMany({
//       where: { chatId: id },
//       include: {
//         sender: { select: { id: true, name: true, role: true } },
//       },
//       orderBy: { createdAt: "asc" },
//     });

//     res.json(messages);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch messages" });
//   }
// };

// export const sendMessage = async (req: AuthRequest, res: Response) => {
//   try {
//     const { id } = req.params; // chatId
//     const { text, fileUrl } = req.body;
//     const userId = req.user?.userId;

//     if (!id) {
//       return res.status(400).json({ error: "Chat ID is required" });
//     }
//     if (!userId) return res.status(401).json({ error: "Unauthorized" });

//     // Проверка, что участник чата
//     const participant = await prisma.chatParticipant.findFirst({
//       where: { chatId: id, userId },
//     });
//     if (!participant) return res.status(403).json({ error: "Access denied" });

//     const message = await prisma.message.create({
//       data: {
//         chatId: id,
//         senderId: userId,
//         text,
//         fileUrl,
//       },
//     });

//     // обновляем updatedAt чата
//     await prisma.chat.update({
//       where: { id },
//       data: { updatedAt: new Date() },
//     });

//     res.json(message);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to send message" });
//   }
// };
// export const getVacancyCandidates = async (req: AuthRequest, res: Response) => {
//   try {
//     const { id } = req.params; // vacancyId
//     const userId = req.user?.userId;

//     if (!userId) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     // проверим, что текущий пользователь — работодатель этой вакансии
//     const vacancy = await prisma.vacancy.findUnique({
//       where: { id },
//       include: { employer: true },
//     });

//     if (!vacancy) {
//       return res.status(404).json({ error: "Вакансия не найдена" });
//     }

//     const employer = await prisma.employerProfile.findUnique({
//       where: { userId },
//     });

//     if (!employer || vacancy.employerId !== employer.id) {
//       return res.status(403).json({ error: "Доступ запрещен: не ваша вакансия" });
//     }

//     // тянем отклики + профили кандидатов
//     const responses = await prisma.response.findMany({
//       where: { vacancyId: id },
//       include: {
//         user: {
//           include: {
//             candidateProfile: true, // профиль кандидата
//           },
//         },
//       },
//     });

//     // маппим под удобный формат
//     const candidates = responses.map((r) => ({
//       responseId: r.id,
//       status: r.status,
//       coverLetter: r.coverLetter,
//       resumeUrls: r.resumeUrls,
//       respondedAt: r.createdAt,
//       candidate: r.user.candidateProfile
//         ? {
//             id: r.user.candidateProfile.id,
//             fullName: r.user.candidateProfile.fullName,
//             city: r.user.candidateProfile.city,
//             country: r.user.candidateProfile.country,
//             experience: r.user.candidateProfile.experience,
//             skills: r.user.candidateProfile.skills,
//             photoUrl: r.user.candidateProfile.photoUrl,
//           }
//         : null,
//     }));

//     res.json(candidates);
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ error: "Ошибка при получении кандидатов", details: err.message });
//   }
// };