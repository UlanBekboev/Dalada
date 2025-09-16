import { Response } from 'express';
import { prisma } from '../prismaClient.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { getIO } from '../sockets/socketHandler.js';

export const startChat = async (req: AuthRequest, res: Response) => {
  try {
    const { candidateId, templateText } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Проверяем роль пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    if (user?.role !== 'EMPLOYER') {
      return res.status(403).json({ error: "Only employers can start chats" });
    }

    // Проверим, существует ли кандидат
    const candidate = await prisma.user.findUnique({
      where: { id: candidateId },
      include: { candidateProfile: true }
    });
    
    if (!candidate || !candidate.candidateProfile) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    // Проверим, есть ли уже чат
    const existingChat = await prisma.chat.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: candidateId } } },
          { participants: { some: { userId } } }
        ]
      },
    });

    if (existingChat) return res.json({ chatId: existingChat.id });

    // Создаём чат
    const chat = await prisma.chat.create({
      data: {
        participants: {
          create: [
            { userId: candidateId, role: "CANDIDATE" },
            { userId, role: "EMPLOYER" },
          ],
        },
      },
    });

    // Первое сообщение (шаблон можно редактировать перед отправкой)
    await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: userId,
        text: templateText || "Здравствуйте, хочу обсудить сотрудничество!",
      },
    });

    // Обновляем updatedAt чата
    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    // Отправляем уведомление через сокет
    try {
      const io = getIO();
      io.to(chat.id).emit('chat-created', chat);
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.json({ chatId: chat.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start chat" });
  }
};

export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.userId;
    
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Валидация параметров пагинации
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 100);
    const skip = (pageNum - 1) * limitNum;

    // Проверка доступа
    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId: id, userId },
    });
    if (!participant) return res.status(403).json({ error: "Access denied" });

    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where: { chatId: id },
        include: {
          sender: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
        take: limitNum,
        skip: skip,
      }),
      prisma.message.count({
        where: { chatId: id },
      })
    ]);

    res.json({
      messages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text, fileUrl, fileName, fileType, fileSize } = req.body;
    const userId = req.user?.userId;

    if (!id) {
      return res.status(400).json({ error: "Chat ID is required" });
    }
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Проверка, что участник чата
    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId: id, userId },
    });
    if (!participant) return res.status(403).json({ error: "Access denied" });

    // Проверка существования чата
    const chatExists = await prisma.chat.findUnique({
      where: { id },
    });
    if (!chatExists) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Если прикреплен файл, проверяем его наличие
    if (fileUrl && !fileName) {
      return res.status(400).json({ error: "FileName is required when fileUrl is provided" });
    }

    const message = await prisma.message.create({
      data: {
        chatId: id,
        senderId: userId,
        text,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize ? parseInt(fileSize) : null,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        ReadReceipt: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
    });

    // Обновляем updatedAt чата
    await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Отправляем сообщение через сокеты
    const io = getIO();
    io.to(id).emit('new-message', message);

    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

export const getChatInfo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Проверка доступа
    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId: id, userId },
    });
    if (!participant) return res.status(403).json({ error: "Access denied" });

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                candidateProfile: { select: { photoUrl: true, desiredRole: true } },
                employerProfile: { select: { companyName: true, logoUrl: true } }
              }
            }
          }
        }
      }
    });

    if (!chat) return res.status(404).json({ error: "Chat not found" });

    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch chat info" });
  }
};

// Дополнительная функция для получения списка чатов пользователя
export const getUserChats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          some: { userId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                candidateProfile: { select: { photoUrl: true, desiredRole: true } },
                employerProfile: { select: { companyName: true, logoUrl: true } }
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user chats" });
  }
};

export const getFilteredChats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { onlyRead } = req.query;
    
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          some: { userId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                candidateProfile: { select: { photoUrl: true, desiredRole: true } },
                employerProfile: { select: { companyName: true, logoUrl: true } }
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            ReadReceipt: {
              where: {
                userId
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Если запрошены только прочитанные чаты
    if (onlyRead === 'true') {
      const filteredChats = chats.filter(chat => {
        // Чат считается прочитанным, если последнее сообщение прочитано текущим пользователем
        const lastMessage = chat.messages[0];
        return lastMessage && lastMessage.ReadReceipt.length > 0;
      });
      return res.json(filteredChats);
    }

    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch filtered chats" });
  }
};

export const markMessagesAsReadService = async (chatId: string, userId: string) => {
  // Находим все непрочитанные сообщения в чате
  const unreadMessages = await prisma.message.findMany({
    where: {
      chatId,
      NOT: {
        ReadReceipt: {
          some: {
            userId
          }
        }
      }
    },
    select: {
      id: true
    }
  });

  // Создаем записи о прочтении
  const readReceipts = unreadMessages.map(message => ({
    messageId: message.id,
    userId
  }));

  if (readReceipts.length > 0) {
    await prisma.readReceipt.createMany({
      data: readReceipts,
      skipDuplicates: true
    });
  }

  return readReceipts.length;
};

export const markMessagesAsReadController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: chatId } = req.params;
    const userId = (req as any).user?.userId; // если user прокидывается через authMiddleware

    if (!chatId) return res.status(400).json({ error: "Chat ID is required" });
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const count = await markMessagesAsReadService(chatId, userId);

    res.json({ success: true, updated: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
};


/**
 * @swagger
 * tags:
 *   - name: Chats
 *     description: "Управление чатами и сообщениями"
 *
 * components:
 *   schemas:
 *     StartChatRequest:
 *       type: object
 *       required:
 *         - candidateId
 *       properties:
 *         candidateId:
 *           type: string
 *           description: "ID кандидата для начала чата"
 *         templateText:
 *           type: string
 *           description: "Текст шаблонного сообщения"
 *     ChatResponse:
 *       type: object
 *       properties:
 *         chatId:
 *           type: string
 *     MessageRequest:
 *       type: object
 *       properties:
 *         text:
 *           type: string
 *         fileUrl:
 *           type: string
 *         fileName:
 *           type: string
 *         fileType:
 *           type: string
 *         fileSize:
 *           type: number
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         chatId:
 *           type: string
 *         senderId:
 *           type: string
 *         text:
 *           type: string
 *         fileUrl:
 *           type: string
 *         fileName:
 *           type: string
 *         fileType:
 *           type: string
 *         fileSize:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         sender:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             role:
 *               type: string
 *         ReadReceipt:
 *           type: array
 *           items:
 *             type: object
 *     PaginatedMessages:
 *       type: object
 *       properties:
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Message'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: number
 *             limit:
 *               type: number
 *             totalCount:
 *               type: number
 *             totalPages:
 *               type: number
 *     ChatInfo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         participants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   role:
 *                     type: string
 *                   candidateProfile:
 *                     type: object
 *                     properties:
 *                       photoUrl:
 *                         type: string
 *                       desiredRole:
 *                         type: string
 *                   employerProfile:
 *                     type: object
 *                     properties:
 *                       companyName:
 *                         type: string
 *                       logoUrl:
 *                         type: string
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     MarkAsReadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         updated:
 *           type: number
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
 * /chats/start:
 *   post:
 *     summary: "Начать чат с кандидатом (только работодатель)"
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartChatRequest'
 *     responses:
 *       200:
 *         description: "Чат создан или найден существующий"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       401:
 *         description: "Не авторизован"
 *       403:
 *         description: "Только работодатели могут начинать чаты"
 *       404:
 *         description: "Кандидат не найден"
 *       500:
 *         description: "Ошибка при создании чата"
 */

/**
 * @swagger
 * /chats/{id}/messages:
 *   get:
 *     summary: "Получить сообщения чата"
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID чата"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: "Номер страницы"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: "Количество сообщений на странице"
 *     responses:
 *       200:
 *         description: "Сообщения чата"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedMessages'
 *       401:
 *         description: "Не авторизован"
 *       403:
 *         description: "Доступ запрещен"
 *       500:
 *         description: "Ошибка при получении сообщений"
 */

/**
 * @swagger
 * /chats/{id}/messages:
 *   post:
 *     summary: "Отправить сообщение в чат"
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID чата"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageRequest'
 *     responses:
 *       200:
 *         description: "Сообщение отправлено"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: "Неверный запрос"
 *       401:
 *         description: "Не авторизован"
 *       403:
 *         description: "Доступ запрещен"
 *       404:
 *         description: "Чат не найден"
 *       500:
 *         description: "Ошибка при отправке сообщения"
 */

/**
 * @swagger
 * /chats/{id}:
 *   get:
 *     summary: "Получить информацию о чате"
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID чата"
 *     responses:
 *       200:
 *         description: "Информация о чате"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatInfo'
 *       401:
 *         description: "Не авторизован"
 *       403:
 *         description: "Доступ запрещен"
 *       404:
 *         description: "Чат не найден"
 *       500:
 *         description: "Ошибка при получении информации о чате"
 */

/**
 * @swagger
 * /chats:
 *   get:
 *     summary: "Получить список чатов пользователя"
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Список чатов пользователя"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatInfo'
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при получении списка чатов"
 */

/**
 * @swagger
 * /chats/filtered:
 *   get:
 *     summary: "Получить отфильтрованный список чатов"
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: onlyRead
 *         schema:
 *           type: boolean
 *         description: "Фильтровать только прочитанные чаты"
 *     responses:
 *       200:
 *         description: "Отфильтрованный список чатов"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatInfo'
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при получении списка чатов"
 */

/**
 * @swagger
 * /chats/{id}/read:
 *   post:
 *     summary: "Отметить сообщения как прочитанные"
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID чата"
 *     responses:
 *       200:
 *         description: "Сообщения отмечены как прочитанные"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarkAsReadResponse'
 *       400:
 *         description: "Неверный запрос"
 *       401:
 *         description: "Не авторизован"
 *       500:
 *         description: "Ошибка при отметке сообщений"
 */