import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { broadcastPushNotification } from '../services/notification.service';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { userId: null }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notification = await prisma.notification.findFirst({
      where: { id, OR: [{ userId }, { userId: null }] }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // For broadcasts, a user marking it read should probably track it in a separate table, 
    // but for simplicity we'll just skip marking broadcasts read if they are global, 
    // or just let it update if we decide to change the schema later.
    // Actually, marking a global broadcast as read for a specific user would require a UserNotification read status table.
    // We'll just update it if it has a userId, otherwise ignore.
    if (notification.userId) {
      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true }
      });
      return res.json({ data: updated });
    }

    res.json({ data: notification, message: 'Broadcast notifications cannot be marked as read individually yet' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notification = await prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id }
    });

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const broadcastNotification = async (req: Request, res: Response) => {
  try {
    const { title, body } = req.body;
    
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        body,
        type: 'BROADCAST',
        userId: null // global broadcast
      }
    });

    // Send push notifications
    await broadcastPushNotification(title, body, { type: 'BROADCAST' });

    res.json({ message: `Broadcast sent successfully`, data: notification });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
