import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.util';
import prisma from '../lib/prisma';

export async function getComments(req: Request, res: Response) {
  try {
    const { submissionId } = req.params;

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    });

    if (!submission) {
      return sendError(res, 'Submission not found', 404);
    }

    // Verify access: Admin or owner
    if (req.user!.role !== 'ADMIN' && submission.userId !== req.user!.id) {
      return sendError(res, 'Forbidden', 403);
    }

    const comments = await prisma.comment.findMany({
      where: { submissionId },
      include: {
        user: {
          select: { id: true, name: true, role: true, avatarData: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    sendSuccess(res, comments);
  } catch (error) {
    sendError(res, 'Failed to fetch comments');
  }
}

export async function addComment(req: Request, res: Response) {
  try {
    const { submissionId } = req.params;
    const { message } = req.body;

    if (!message) {
      return sendError(res, 'Message is required', 400);
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    });

    if (!submission) {
      return sendError(res, 'Submission not found', 404);
    }

    // Verify access: Admin or owner
    if (req.user!.role !== 'ADMIN' && submission.userId !== req.user!.id) {
      return sendError(res, 'Forbidden', 403);
    }

    const comment = await prisma.comment.create({
      data: {
        message,
        submissionId,
        userId: req.user!.id
      },
      include: {
        user: {
          select: { id: true, name: true, role: true, avatarData: true }
        }
      }
    });

    // Send push notification to the other party
    try {
      if (req.user!.role === 'ADMIN') {
        await prisma.notification.create({
          data: {
            userId: submission.userId,
            title: 'New Comment on Submission',
            body: `An admin commented on your submission.`,
            type: 'SUBMISSION_STATUS' as const
          }
        });
      } else {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admins.length > 0) {
          await prisma.notification.createMany({
            data: admins.map(a => ({
              userId: a.id,
              title: 'New Comment on Submission',
              body: `${req.user!.name || 'A user'} commented on a submission.`,
              type: 'SUBMISSION_STATUS' as const
            }))
          });
        }
      }
    } catch (e) {
      console.error('Failed to notify about comment', e);
    }

    sendSuccess(res, comment, 201);
  } catch (error) {
    sendError(res, 'Failed to add comment');
  }
}
