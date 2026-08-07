import { Router } from 'express';
import { getHistory, sendMessage, sendReaction } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getHistory);
router.post('/', sendMessage);
router.post('/react', sendReaction);

export default router;
