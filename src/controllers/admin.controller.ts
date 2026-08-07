import { Request, Response } from 'express';
import * as AdminService from '../services/admin.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { AttendanceStatus } from '@prisma/client';
import prisma from '../lib/prisma';

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
    
    // Notify users in the domain
    try {
      const usersInDomain = await prisma.user.findMany({ where: { domain } });
      const notificationData = usersInDomain.map(user => ({
        userId: user.id,
        title: 'New Task Assigned',
        body: `A new task "${title}" has been assigned to your domain.`,
        type: 'TASK_ASSIGNED' as const,
      }));
      await prisma.notification.createMany({ data: notificationData });
    } catch (notifError) {
      console.error('Failed to send task notifications', notifError);
    }

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
    
    try {
      const submission = await prisma.submission.findUnique({ where: { id: req.params.submissionId }, include: { task: true } });
      if (submission) {
        await prisma.notification.create({
          data: {
            userId: submission.userId,
            title: 'Submission Approved',
            body: `Your submission for "${submission.task.title}" has been approved.`,
            type: 'SUBMISSION_STATUS' as const,
          }
        });
      }
    } catch (notifError) {
      console.error('Failed to send submission notification', notifError);
    }

    sendSuccess(res, {});
  } catch {
    sendError(res, 'Failed to approve submission');
  }
}

export async function rejectSubmission(req: Request, res: Response) {
  try {
    await AdminService.rejectSubmission(req.params.submissionId);
    
    try {
      const submission = await prisma.submission.findUnique({ where: { id: req.params.submissionId }, include: { task: true } });
      if (submission) {
        await prisma.notification.create({
          data: {
            userId: submission.userId,
            title: 'Submission Rejected',
            body: `Your submission for "${submission.task.title}" has been rejected.`,
            type: 'SUBMISSION_STATUS' as const,
          }
        });
      }
    } catch (notifError) {
      console.error('Failed to send submission notification', notifError);
    }

    sendSuccess(res, {});
  } catch {
    sendError(res, 'Failed to reject submission');
  }
}

export async function getAttendanceUsers(req: Request, res: Response) {
  try {
    const date = req.query.date as string | undefined;
    const users = await AdminService.getAttendanceUsers(date);
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
    
    // Trigger notifications for all users whose attendance was saved
    try {
      const dateString = new Date(date).toDateString();
      const notificationData = records.map(record => ({
        userId: record.userId,
        title: 'Attendance Marked',
        body: `Your attendance has been marked as ${record.status} for ${dateString}.`,
        type: 'ATTENDANCE' as const,
      }));
      await prisma.notification.createMany({ data: notificationData });
    } catch (notifError) {
      console.error('Failed to send attendance notifications', notifError);
    }

    sendSuccess(res, {});
  } catch {
    sendError(res, 'Failed to save attendance');
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }
    if (user.role === 'ADMIN') {
      sendError(res, 'Cannot delete an admin user', 403);
      return;
    }
    await prisma.user.delete({ where: { id: userId } });
    sendSuccess(res, { message: 'User deleted successfully' });
  } catch {
    sendError(res, 'Failed to delete user');
  }
}

export async function exportAttendanceCSV(req: Request, res: Response) {
  try {
    const records = await prisma.attendance.findMany({
      include: { user: { select: { name: true, email: true, domain: true } } },
      orderBy: { date: 'desc' }
    });

    const header = 'Date,Student Name,Email,Domain,Status';
    const rows = records.map(r => {
      const date = new Date(r.date).toISOString().split('T')[0];
      const name = (r.user.name || '').replace(/,/g, ' ');
      const email = r.user.email;
      const domain = r.user.domain || '';
      return `${date},${name},${email},${domain},${r.status}`;
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
    res.send(csv);
  } catch {
    sendError(res, 'Failed to export attendance');
  }
}

export async function exportSubmissionsCSV(req: Request, res: Response) {
  try {
    const submissions = await prisma.submission.findMany({
      include: {
        user: { select: { name: true, email: true, domain: true } },
        task: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const header = 'Task Title,Student Name,Email,Domain,Status,GitHub Link,Demo Link,Date';
    const rows = submissions.map(s => {
      const date = new Date(s.createdAt).toISOString().split('T')[0];
      const name = (s.user.name || '').replace(/,/g, ' ');
      const taskTitle = s.task.title.replace(/,/g, ' ');
      return `${taskTitle},${name},${s.user.email},${s.user.domain || ''},${s.status},${s.githubLink},${s.demoLink},${date}`;
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=submissions.csv');
    res.send(csv);
  } catch {
    sendError(res, 'Failed to export submissions');
  }
}

export async function exportUsersCSV(req: Request, res: Response) {
  try {
    const userIds = req.query.userIds as string | undefined;
    const where: any = {};
    if (userIds) {
      where.id = { in: userIds.split(',') };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, domain: true,
        isVerified: true, createdAt: true,
        _count: { select: { submissions: true, attendance: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const header = 'Name,Email,Role,Domain,Verified,Submissions,Attendance Records,Joined';
    const rows = users.map(u => {
      const date = new Date(u.createdAt).toISOString().split('T')[0];
      const name = (u.name || '').replace(/,/g, ' ');
      return `${name},${u.email},${u.role},${u.domain || ''},${u.isVerified},${u._count.submissions},${u._count.attendance},${date}`;
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csv);
  } catch {
    sendError(res, 'Failed to export users');
  }
}

export async function exportUserDataCSV(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        attendance: { orderBy: { date: 'desc' } },
        submissions: { include: { task: true }, orderBy: { createdAt: 'desc' } }
      }
    });

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    let csv = `User Report: ${user.name || user.email}\n`;
    csv += `Email,${user.email}\n`;
    csv += `Role,${user.role}\n`;
    csv += `Domain,${user.domain || 'N/A'}\n`;
    csv += `Joined,${new Date(user.createdAt).toISOString().split('T')[0]}\n\n`;

    csv += `ATTENDANCE\nDate,Status\n`;
    user.attendance.forEach(a => {
      csv += `${new Date(a.date).toISOString().split('T')[0]},${a.status}\n`;
    });

    csv += `\nSUBMISSIONS\nTask,Status,GitHub,Demo,Date\n`;
    user.submissions.forEach(s => {
      const date = new Date(s.createdAt).toISOString().split('T')[0];
      csv += `${s.task.title.replace(/,/g, ' ')},${s.status},${s.githubLink},${s.demoLink},${date}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=user_${userId}.csv`);
    res.send(csv);
  } catch {
    sendError(res, 'Failed to export user data');
  }
}
