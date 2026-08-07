import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { Domain } from '@prisma/client';

export async function getMe(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, domain: true },
  });
}

export async function getTasksForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  return prisma.task.findMany({
    where: {
      OR: [
        ...(user?.domain ? [{ domain: user.domain }] : []),
        { domain: 'COMMON' as Domain },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTaskWithSubmission(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });

  if (!task) return null;

  const submission = await prisma.submission.findFirst({
    where: { taskId, userId },
  });

  return { task, submission };
}

export async function getUserSubmissions(userId: string) {
  return prisma.submission.findMany({
    where: { userId },
    include: { task: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createSubmission(
  userId: string,
  taskId: string,
  githubLink: string,
  demoLink: string,
  remarks?: string
) {
  const existing = await prisma.submission.findFirst({
    where: { taskId, userId },
  });

  if (existing) {
    throw new Error('Already submitted for this task');
  }

  return prisma.submission.create({
    data: {
      userId,
      taskId,
      githubLink,
      demoLink,
      remarks,
    },
  });
}

export async function updateSubmission(
  userId: string,
  taskId: string,
  githubLink: string,
  demoLink: string,
  remarks?: string
) {
  const existing = await prisma.submission.findFirst({
    where: { taskId, userId },
  });

  if (!existing) {
    throw new Error('Submission not found');
  }

  if (existing.status !== 'PENDING') {
    throw new Error('Only pending submissions can be edited');
  }

  return prisma.submission.update({
    where: { id: existing.id },
    data: {
      githubLink,
      demoLink,
      remarks,
    },
  });
}

export async function getUserAttendance(userId: string) {
  const records = await prisma.attendance.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  const total = records.length;
  const present = records.filter((a) => a.status === 'PRESENT').length;
  const absent = records.filter((a) => a.status === 'ABSENT').length;
  const leave = records.filter((a) => a.status === 'LEAVE').length;
  const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : '0';

  return {
    records,
    stats: { total, present, absent, leave, attendanceRate },
  };
}

export async function updatePassword(userId: string, newPassword: string) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
}

export async function updateAvatar(userId: string, avatarData: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { avatarData },
  });
}
