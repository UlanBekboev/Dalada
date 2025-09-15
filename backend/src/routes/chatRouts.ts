import express from 'express';
import {
  startChat,
  getChatMessages,
  sendMessage,
  getChatInfo,
  getUserChats,
  getFilteredChats,
  markMessagesAsReadController
} from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Получение отфильтрованных чатов (только прочитанные)
router.get('/', authMiddleware, getUserChats);
router.get('/filtered', authMiddleware, getFilteredChats);
router.post('/:id/mark-read', authMiddleware, markMessagesAsReadController);
router.post('/start', authMiddleware, startChat);
router.get('/:id/messages', authMiddleware, getChatMessages);
router.post('/:id/messages', authMiddleware, sendMessage);
router.get('/:id/info', authMiddleware, getChatInfo);



export default router;