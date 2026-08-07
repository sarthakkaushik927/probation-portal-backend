import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as UserController from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/me', UserController.getMe);
router.get('/tasks', UserController.getTasks);
router.get('/tasks/:taskId', UserController.getTask);
router.get('/submissions', UserController.getSubmissions);
router.post('/submissions', UserController.submitTask);
router.get('/attendance', UserController.getAttendance);

export default router;
