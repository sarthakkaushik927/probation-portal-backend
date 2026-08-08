import { prisma } from '../lib/prisma';
import { Domain, AttendanceStatus } from '@prisma/client';
import { sendPushNotification } from './notification.service';

export async function getDashboardStats() {
  const [totalUsers, activeTasks, pendingReviews] = await Promise.all([
    prisma.user.count(),
    prisma.task.count(),
    prisma.submission.count({ where: { status: 'PENDING' } }),
  ]);

  return { totalUsers, activeTasks, pendingReviews };
}

export async function getAllUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      domain: true,
      isVerified: true,
      createdAt: true,
      studentType: true,
      phoneNumber: true,
      _count: {
        select: { submissions: true, attendance: true }
      }
    },
  });
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { submissions: { include: { task: true } } },
  });

  if (!user) return null;

  const attendance = await prisma.attendance.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  const present = attendance.filter((a) => a.status === 'PRESENT').length;
  const absent = attendance.filter((a) => a.status === 'ABSENT').length;
  const leave = attendance.filter((a) => a.status === 'LEAVE').length;
  const workingDays = present + absent;
  const percentage = workingDays === 0 ? 0 : Math.round((present / workingDays) * 100);

  const { password: _pw, ...safeUser } = user;

  return {
    user: safeUser,
    attendance,
    stats: { present, absent, leave, percentage },
  };
}

export async function updateUserDomain(userId: string, domain: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      domain: domain === 'UNASSIGNED' || !domain ? null : (domain as Domain),
    },
  });
}

export async function getAllTasks() {
  return prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createTask(
  title: string,
  description: string,
  domain: string,
  deadline: string,
  attachments?: string[]
) {
  const task = await prisma.task.create({
    data: {
      title,
      description,
      domain: domain as Domain,
      deadline: new Date(deadline),
      attachments: attachments || [],
    },
  });

  // Send push notification to users in this domain (or all if COMMON)
  const users = await prisma.user.findMany({
    where: {
      ...(domain !== 'COMMON' ? { domain: domain as Domain } : {}),
      expoPushToken: { not: null }
    },
    select: { expoPushToken: true }
  });

  const pushTokens = users.map(u => u.expoPushToken!).filter(token => token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')));
  if (pushTokens.length > 0) {
    const messages = pushTokens.map(token => ({
      to: token,
      sound: 'default' as 'default',
      title: 'New Task Assigned 📋',
      body: `A new task "${title}" has been assigned to your domain.`,
    }));
    try {
      for (const msg of messages) {
        await sendPushNotification(msg.to, msg.title, msg.body);
      }
    } catch (e) {
      console.error(e);
    }
  }

  return task;
}

export async function updateTask(
  taskId: string,
  title: string,
  description: string,
  domain: string,
  deadline: string,
  attachments?: string[]
) {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description,
      domain: domain as Domain,
      deadline: new Date(deadline),
      ...(attachments ? { attachments } : {}),
    },
  });
}

export async function getAllSubmissions() {
  return prisma.submission.findMany({
    include: { user: true, task: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSubmissionById(submissionId: string) {
  return prisma.submission.findUnique({
    where: { id: submissionId },
    include: { user: true, task: true },
  });
}

export async function approveSubmission(submissionId: string) {
  const submission = await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'APPROVED' },
    include: { user: true, task: true }
  });

  if (submission.user.expoPushToken) {
    await sendPushNotification(
      submission.user.expoPushToken, 
      'Submission Approved! ✅', 
      `Your submission for "${submission.task.title}" was approved.`
    );
  }
}

export async function rejectSubmission(submissionId: string) {
  const submission = await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'REJECTED' },
    include: { user: true, task: true }
  });

  if (submission.user.expoPushToken) {
    await sendPushNotification(
      submission.user.expoPushToken, 
      'Submission Rejected ❌', 
      `Your submission for "${submission.task.title}" needs work.`
    );
  }
}

export async function getAttendanceUsers(date?: string) {
  return prisma.user.findMany({
    where: { role: 'USER' },
    orderBy: { name: 'asc' },
    select: { 
      id: true, 
      name: true, 
      email: true, 
      domain: true,
      attendance: date ? {
        where: {
          date: new Date(new Date(date).setUTCHours(0,0,0,0))
        }
      } : false
    },
  });
}

export async function saveAttendanceRecords(
  date: string,
  records: { userId: string; status: AttendanceStatus }[]
) {
  const normalizedDate = new Date(new Date(date).setUTCHours(0,0,0,0));
  for (const record of records) {
    await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: record.userId,
          date: normalizedDate,
        },
      },
      update: { status: record.status },
      create: {
        userId: record.userId,
        date: normalizedDate,
        status: record.status,
      },
    });
  }
}
