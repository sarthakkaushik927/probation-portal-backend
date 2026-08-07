import { Request, Response } from 'express';
import { getRecentMessages, saveMessage } from '../services/chat.service';
import { broadcast } from '../lib/realtime';
import { sendSuccess, sendError } from '../utils/response.util';
import prisma from '../lib/prisma';
import { sendPushNotification } from '../services/notification.service';

export async function getHistory(req: Request, res: Response) {
  try {
    const messages = await getRecentMessages(50);
    sendSuccess(res, messages);
  } catch (error) {
    console.error(error);
    sendError(res, 'Failed to fetch chat history');
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return sendError(res, 'Content is required', 400);
    }

    const message = await saveMessage(userId, content);

    // Broadcast to the global 'global-chat' channel
    await broadcast('global-chat', 'new_message', message);

    // Detect @mentions (simple @username pattern) and notify mentioned users
    try {
      const mentionMatches = Array.from(content.matchAll(/@(\w+)/g)).map(m => m[1]);
      if (mentionMatches.length > 0) {
        // For each unique mention, find the user (case-insensitive match on name)
        const uniqueNames = Array.from(new Set(mentionMatches));
        const notifyPromises: Promise<any>[] = [];

        for (const name of uniqueNames) {
          const mentionedUser = await prisma.user.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true, name: true, expoPushToken: true } });
          if (!mentionedUser) continue;
          if (mentionedUser.id === userId) continue; // don't notify self

          const title = `${message.user.name} mentioned you`;
          const body = content.length > 120 ? content.slice(0, 120) + '…' : content;

          // Create a notification record for the mentioned user
          notifyPromises.push(prisma.notification.create({ data: {
            title,
            body,
            type: 'BROADCAST',
            userId: mentionedUser.id,
          } }));

          // Send a push notification if they have a token (fire-and-forget)
          if (mentionedUser.expoPushToken) {
            sendPushNotification(mentionedUser.expoPushToken, title, body, { type: 'MENTION', messageId: message.id }).catch(err => console.error('Mention push error:', err));
          }

          // Broadcast a realtime 'mention' event to the mentioned user's personal channel
          try {
            await broadcast(`user-${mentionedUser.id}`, 'mention', {
              message: { id: message.id, content: message.content, createdAt: message.createdAt },
              from: { id: message.user.id, name: message.user.name },
            });
          } catch (err) {
            console.error('Realtime mention broadcast error:', err);
          }
        }

        // Wait for DB notifications to be created (non-blocking to client response)
        Promise.allSettled(notifyPromises).then(() => {}).catch(() => {});
      }
    } catch (err) {
      console.error('Mention processing error:', err);
    }

    sendSuccess(res, message);
  } catch (error) {
    console.error(error);
    sendError(res, 'Failed to send message');
  }
}

export async function sendReaction(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const { type } = req.body; // e.g. 'heart', 'thumbsup'

    // Instantly broadcast the flying emoji to everyone
    await broadcast('global-chat', 'flying_emoji', { userId, type });

    sendSuccess(res, {});
  } catch (error) {
    console.error(error);
    sendError(res, 'Failed to send reaction');
  }
}
