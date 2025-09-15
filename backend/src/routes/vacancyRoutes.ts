import { Router } from 'express';
import {
  createVacancy,
  updateVacancy,
  publishVacancy,
  deleteVacancy,
  getVacancies,
  respondToVacancy,
  getVacancyResponses,
  getVacancyDescriptionById,
} from '../controllers/vacancyController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getMyRespondedVacancies, updateResponseStatus } from '../controllers/vacancyAdditional.js';
import { candidateAction, getCandidateProfileById, getCandidatesForVacancy } from '../controllers/employerProfileController.js';

const router = Router();

// Сначала определяем специфичные маршруты
router.get('/my/responses', authMiddleware, getMyRespondedVacancies);

// Затем определяем маршруты с параметрами
router.get('/:id/responses', authMiddleware, getVacancyResponses);
router.get('/:id', authMiddleware, getVacancyDescriptionById);

// Остальные маршруты
router.post('/', authMiddleware, createVacancy);
router.put('/:id', authMiddleware, updateVacancy);
router.post('/:id/publish', authMiddleware, publishVacancy);
router.get('/', authMiddleware, getVacancies); // Только один GET / маршрут
router.delete('/:id', authMiddleware, deleteVacancy);
router.post('/:id/respond', authMiddleware, respondToVacancy);
//router.post('/:responseId/resume', authMiddleware, sendResume);
router.patch('/:id/status', authMiddleware, updateResponseStatus);

// GET /vacancy/:id/candidates?page=1&limit=10
router.get('/:id/candidates', authMiddleware, getCandidatesForVacancy);
router.post('/:id/candidates/:candidateId/action', authMiddleware, candidateAction);
router.get('/candidate/:id', authMiddleware, getCandidateProfileById);



export default router;