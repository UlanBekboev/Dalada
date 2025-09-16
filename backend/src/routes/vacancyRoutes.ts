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

// Responses Управление откликами на вакансии
router.get('/responses/my', authMiddleware, getMyRespondedVacancies);
router.patch('/responses/:id', authMiddleware, updateResponseStatus);

// Vacancy Вакансии и отклики
router.get('/vacancy/:id/responses', authMiddleware, getVacancyResponses);
router.get('/vacancy/:id/description', authMiddleware, getVacancyDescriptionById);

// Остальные маршруты
router.post('/vacancy', authMiddleware, createVacancy);
router.get('/vacancy', authMiddleware, getVacancies);
router.put('/vacancy/:id', authMiddleware, updateVacancy);
router.post('/vacancy/:id/publish', authMiddleware, publishVacancy);
router.delete('/vacancy/:id', authMiddleware, deleteVacancy);
router.post('/vacancy/:id/respond', authMiddleware, respondToVacancy);
//router.post('/:responseId/resume', authMiddleware, sendResume);

router.get('/vacancy/:id/candidates', authMiddleware, getCandidatesForVacancy);
router.post('/vacancy/:id/candidates/:candidateId/action', authMiddleware, candidateAction);
router.get('/candidate/:id', authMiddleware, getCandidateProfileById);

export default router;