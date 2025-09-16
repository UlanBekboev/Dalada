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


/**
 * @swagger
 * tags:
 *   - name: Responses
 *     description: "Управление откликами на вакансии"
 *
 * components:
 *   schemas:
 *     RespondedVacancy:
 *       type: object
 *       properties:
 *         responseId:
 *           type: string
 *         status:
 *           type: string
 *         respondedAt:
 *           type: string
 *           format: date-time
 *         vacancy:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             title:
 *               type: string
 *             city:
 *               type: string
 *             salaryFrom:
 *               type: number
 *             salaryTo:
 *               type: number
 *             currency:
 *               type: string
 *             employer:
 *               type: object
 *               properties:
 *                 companyName:
 *                   type: string
 *                 logoUrl:
 *                   type: string
 *     ResponseStatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *         details:
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
 * /responses/my:
 *   get:
 *     summary: "Получить список вакансий, на которые откликнулся текущий пользователь"
 *     tags: [Responses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Список откликов пользователя"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RespondedVacancy'
 *       401:
 *         description: "Не авторизован"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: "Ошибка при получении откликов"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /responses/{id}:
 *   patch:
 *     summary: "Обновить статус отклика (только владелец вакансии)"
 *     tags: [Responses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID отклика"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResponseStatusUpdate'
 *     responses:
 *       200:
 *         description: "Статус отклика обновлен"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 updated:
 *                   type: object
 *       400:
 *         description: "Неверный запрос"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: "Не авторизован"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: "Доступ запрещен"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: "Отклик не найден"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: "Ошибка при обновлении статуса отклика"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */