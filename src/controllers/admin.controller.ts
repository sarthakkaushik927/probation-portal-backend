import { Request, Response } from 'express';
import * as AdminService from '../services/admin.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { AttendanceStatus } from '@prisma/client';

export async function getDashboard(_req: Request, res: Response) {
  try {
    const stats = await AdminService.getDashboardStats();
    sendSuccess(res, stats);
  } catch {
    sendError(res, 'Failed to fetch dashboard stats');
  }
}

export async function getUsers(_req: Request, res: Response) {
  try {
    const users = await AdminService.getAllUsers();
    sendSuccess(res, users);
  } catch {
    sendError(res, 'Failed to fetch users');
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const result = await AdminService.getUserById(req.params.userId);

    if (!result) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, result);
  } catch {
    sendError(res, 'Failed to fetch user');
  }
}

export async function updateDomain(req: Request, res: Response) {
  try {
    const { domain } = req.body;
    await AdminService.updateUserDomain(req.params.userId, domain);
    sendSuccess(res, {});
  } catch {
    sendError(res, 'Failed to update domain');
  }
}

export async function getTasks(_req: Request, res: Response) {
  try {
    const tasks = await AdminService.getAllTasks();
    sendSuccess(res, tasks);
  } catch {
    sendError(res, 'Failed to fetch tasks');
  }
}

export async function createTask(req: Request, res: Response) {
  try {
    const { title, description, domain, deadline } = req.body;

    if (!title || !description || !domain || !deadline) {
      sendError(res, 'All fields are required', 400);
      return;
    }

    const task = await AdminService.createTask(title, description, domain, deadline);
    sendSuccess(res, task, 201);
  } catch {
    sendError(res, 'Failed to create task');
  }
}

export async function updateTask(req: Request, res: Response) {
  try {
    const { title, description, domain, deadline } = req.body;

    await AdminService.updateTask(
      req.params.taskId,
      title,
      description,
      domain,
      deadline
    );

    sendSuccess(res, {});
  } catch {
    sendError(res, 'Failed to update task');
  }
}

export async function getSubmissions(_req: Request, res: Response) {
  try {
    const submissions = await AdminService.getAllSubmissions();
    sendSuccess(res, submissions);
  } catch {
    sendError(res, 'Failed to fetch submissions');
  }
}

export async function getSubmission(req: Request, res: Response) {
  try {
    const submission = await AdminService.getSubmissionById(req.params.submissionId);

    if (!submission) {
      sendError(res, 'Submission not found', 404);
      return;
    }

    sendSuccess(res, submission);
  } catch {
    sendError(res, 'Failed to fetch submission');
  }
}

export async function approveSubmission(req: Request, res: Response) {
  try {
    await AdminService.approveSubmission(req.params.submissionId);
    sendSuccess(res, {});
  } catch {
    sendError(res, 'Failed to approve submission');
  }
}

export async function rejectSubmission(req: Request, res: Response) {
  try {
    await AdminService.rejectSubmission(req.params.submissionId);
    sendSuccess(res, {});
  } catch {
    sendError(res, 'Failed to reject submission');
  }
}

export async function getAttendanceUsers(_req: Request, res: Response) {
  try {
    const users = await AdminService.getAttendanceUsers();
    sendSuccess(res, users);
  } catch {
    sendError(res, 'Failed to fetch users');
  }
}

export async function saveAttendance(req: Request, res: Response) {
  try {
    const { date, records } = req.body as {
      date: string;
      records: { userId: string; status: AttendanceStatus }[];
    };

    if (!date || !records || !Array.isArray(records)) {
      sendError(res, 'date and records array are required', 400);
      return;
    }

    await AdminService.saveAttendanceRecords(date, records);
    sendSuccess(res, {});
  } catch {
    sendError(res, 'Failed to save attendance');
  }
}
