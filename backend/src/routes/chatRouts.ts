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

router.post('/start', authMiddleware, startChat);
router.get('/:id/messages', authMiddleware, getChatMessages);
router.post('/:id/messages', authMiddleware, sendMessage);
router.get('/:id', authMiddleware, getChatInfo);
// Получение отфильтрованных чатов (только прочитанные)
router.get('/', authMiddleware, getUserChats);
router.get('/filtered', authMiddleware, getFilteredChats);
router.post('/:id/read', authMiddleware, markMessagesAsReadController);





export default router;