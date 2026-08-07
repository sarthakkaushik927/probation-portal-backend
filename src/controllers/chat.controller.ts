import { Request, Response } from 'express';
import { getRecentMessages, saveMessage } from '../services/chat.service';
import { broadcast } from '../lib/realtime';
import { sendSuccess, sendError } from '../utils/response.util';

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
