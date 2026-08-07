import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, broadcastNotification } from '../controllers/notification.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// User routes (both ADMIN and USER)
router.get('/', authenticate, getNotifications);
router.put('/read-all', authenticate, markAllAsRead);
router.put('/:id/read', authenticate, markAsRead);

// Admin only routes
router.post('/broadcast', authenticate, requireAdmin, broadcastNotification);

export default router;
