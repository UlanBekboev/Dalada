// sockets/socketHandler.ts
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../prismaClient.js';
import { markMessagesAsReadService } from '../controllers/chatController.js';

// Расширяем интерфейс для хранения пользовательских данных
declare module 'socket.io' {
  interface Socket {
    userId?: string;
    user?: any;
  }
}

let io: Server;

export const initSocketIO = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  // Middleware для аутентификации
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          role: true,
          candidateProfile: { select: { id: true } },
          employerProfile: { select: { id: true } },
        },
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);

    // Присоединение к комнатам чатов пользователя
    socket.on('join-chats', async () => {
      try {
        const userChats = await prisma.chatParticipant.findMany({
          where: { userId: socket.userId },
          select: { chatId: true },
        });

        userChats.forEach((participant: { chatId: string }) => {
          socket.join(participant.chatId);
          console.log(`User ${socket.userId} joined chat ${participant.chatId}`);
        });
      } catch (error) {
        console.error('Error joining chats:', error);
      }
    });

    // Присоединение к конкретному чату
    socket.on('join-chat', async (chatId: string) => {
      try {
        // Проверяем, есть ли у пользователя доступ к чату
        const participant = await prisma.chatParticipant.findFirst({
          where: {
            chatId,
            userId: socket.userId!,
          },
        });

        if (!participant) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
        }

        socket.join(chatId);
        console.log(`User ${socket.userId} joined chat ${chatId}`);

        // Отмечаем все сообщения как прочитанные
        await markMessagesAsReadService(chatId, socket.userId!);

        // Уведомляем других участников
        socket.to(chatId).emit('user-joined-chat', {
          userId: socket.userId,
          userName: socket.user?.name,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error joining chat:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Обработка отправки сообщения
    socket.on('send-message', async (data) => {
      try {
        const { chatId, text, fileUrl, fileName, fileType, fileSize } = data;

        // Проверка доступа
        const participant = await prisma.chatParticipant.findFirst({
          where: {
            chatId,
            userId: socket.userId!,
          },
        });

        if (!participant) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Создаем сообщение в БД
        const message = await prisma.message.create({
          data: {
            chatId,
            senderId: socket.userId!,
            text,
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            fileType: fileType || null,
            fileSize: fileSize ? parseInt(fileSize) : null,
          },
          include: {
            sender: { select: { id: true, name: true, role: true } },
          },
        });

        // Обновляем время последней активности чата
        await prisma.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });

        // Отправляем сообщение всем участникам чата
        io.to(chatId).emit('new-message', message);

        // Отправляем уведомление о новом сообщении
        socket.to(chatId).emit('new-message-notification', {
          chatId,
          message: {
            id: message.id,
            text: message.text,
            sender: message.sender,
            createdAt: message.createdAt,
          },
        });
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Обработка набора текста (typing indicator)
    socket.on('typing-start', (chatId: string) => {
      socket.to(chatId).emit('user-typing', {
        userId: socket.userId,
        userName: socket.user?.name,
        chatId,
      });
    });

    socket.on('typing-stop', (chatId: string) => {
      socket.to(chatId).emit('user-stop-typing', {
        userId: socket.userId,
        chatId,
      });
    });

    // Обработка отметки сообщений как прочитанных
    socket.on('mark-messages-read', async (data: { messageIds: string[]; chatId: string }) => {
      try {
        const { messageIds, chatId } = data;

        // Проверяем доступ
        const participant = await prisma.chatParticipant.findFirst({
          where: {
            chatId,
            userId: socket.userId!,
          },
        });

        if (!participant) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Создаем записи о прочтении
        const readReceipts = messageIds.map((messageId) => ({
          messageId,
          userId: socket.userId!,
        }));

        await prisma.readReceipt.createMany({
          data: readReceipts,
          skipDuplicates: true,
        });

        // Уведомляем других участников
        socket.to(chatId).emit('messages-read', {
          messageIds,
          userId: socket.userId,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Обработка отключения
    socket.on('disconnect', (reason) => {
      console.log('User disconnected:', socket.userId, 'Reason:', reason);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
