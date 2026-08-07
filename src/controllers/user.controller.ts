import { Request, Response } from 'express';
import * as UserService from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response.util';
import prisma from '../lib/prisma';

export async function getMe(req: Request, res: Response) {
  try {
    const user = await UserService.getMe(req.user!.id);

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, user);
  } catch {
    sendError(res, 'Failed to fetch profile');
  }
}

export async function getTasks(req: Request, res: Response) {
  try {
    const tasks = await UserService.getTasksForUser(req.user!.id);
    sendSuccess(res, tasks);
  } catch {
    sendError(res, 'Failed to fetch tasks');
  }
}

export async function getTask(req: Request, res: Response) {
  try {
    const result = await UserService.getTaskWithSubmission(
      req.params.taskId,
      req.user!.id
    );

    if (!result) {
      sendError(res, 'Task not found', 404);
      return;
    }

    sendSuccess(res, result);
  } catch {
    sendError(res, 'Failed to fetch task');
  }
}

export async function getSubmissions(req: Request, res: Response) {
  try {
    const submissions = await UserService.getUserSubmissions(req.user!.id);
    sendSuccess(res, submissions);
  } catch {
    sendError(res, 'Failed to fetch submissions');
  }
}

export async function submitTask(req: Request, res: Response) {
  try {
    const { taskId, githubLink, demoLink, remarks } = req.body;

    if (!taskId || !githubLink || !demoLink) {
      sendError(res, 'taskId, githubLink, and demoLink are required', 400);
      return;
    }

    await UserService.createSubmission(
      req.user!.id,
      taskId,
      githubLink,
      demoLink,
      remarks
    );

    // Notify admins
    try {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
      const userName = req.user?.name || 'A user';
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            title: 'New Task Submission',
            message: `${userName} just submitted a task.`,
            type: 'SUBMISSION'
          }))
        });
      }
    } catch (notifErr) {
      console.error('Failed to send submission notifications', notifErr);
    }

    sendSuccess(res, {}, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit task';
    const statusCode = message === 'Already submitted for this task' ? 409 : 500;
    sendError(res, message, statusCode);
  }
}

export async function getAttendance(req: Request, res: Response) {
  try {
    const data = await UserService.getUserAttendance(req.user!.id);
    sendSuccess(res, data);
  } catch {
    sendError(res, 'Failed to fetch attendance');
  }
}
