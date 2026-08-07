import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notifications = await prisma.notification.findMany({
      where: { userId },
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
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const broadcastNotification = async (req: Request, res: Response) => {
  try {
    const { title, message } = req.body;
    
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const allUsers = await prisma.user.findMany({ select: { id: true } });
    
    // In a real app, use createMany for performance
    const notifications = await prisma.notification.createMany({
      data: allUsers.map((user: any) => ({
        title,
        message,
        type: 'MANUAL',
        userId: user.id
      }))
    });

    res.json({ message: `Broadcast sent to ${notifications.count} users` });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
