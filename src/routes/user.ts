import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as UserController from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/me', UserController.getMe);
router.get('/directory', UserController.getDirectory);
router.get('/tasks', UserController.getTasks);
router.get('/tasks/:taskId', UserController.getTask);
router.get('/submissions', UserController.getSubmissions);
router.post('/submissions', UserController.submitTask);
router.put('/submissions', UserController.updateSubmission);
router.get('/attendance', UserController.getAttendance);
router.put('/change-password', UserController.updatePassword);
router.put('/profile', UserController.updateProfile);
router.patch('/avatar', UserController.updateAvatar);
router.patch('/push-token', UserController.savePushToken);

// Team submission endpoints
router.get('/team-submissions/:taskId', UserController.getTeamSubmission);
router.post('/team-submissions/:taskId/links', UserController.addTeamLink);
router.delete('/team-submissions/:taskId/links', UserController.removeTeamLink);
router.post('/team-submissions/:taskId/attachments', UserController.addTeamAttachment);

export default router;
