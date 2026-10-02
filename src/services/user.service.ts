import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { Domain } from '@prisma/client';
import { broadcast } from '../lib/realtime';

export async function getMe(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, domain: true, avatarData: true },
  });
}

export async function getTasksForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Get individual tasks for user's domain (or COMMON)
  const individualTasks = await prisma.task.findMany({
    where: {
      type: 'INDIVIDUAL',
      OR: [
        ...(user?.domain ? [{ domain: user.domain }] : []),
        { domain: 'COMMON' as Domain },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get team tasks assigned to this user
  const teamAssignments = await prisma.taskAssignment.findMany({
    where: { userId },
    include: {
      task: {
        include: {
          assignedUsers: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarData: true },
              },
            },
          },
          teamSubmission: true,
        },
      },
    },
  });

  const teamTasks = teamAssignments.map(a => a.task);

  return [...individualTasks, ...teamTasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getTaskWithSubmission(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedUsers: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarData: true },
          },
        },
      },
      teamSubmission: true,
    },
  });

  if (!task) return null;

  // For team tasks, verify user is assigned
  if (task.type === 'TEAM') {
    const isAssigned = task.assignedUsers.some(a => a.userId === userId);
    if (!isAssigned) return null;

    return {
      task,
      submission: null,
      teamSubmission: task.teamSubmission,
      members: task.assignedUsers.map(a => a.user),
    };
  }

  // For individual tasks
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
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error('Task not found');
  }

  // Late submissions are allowed, we'll show a badge on the frontend
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

// --- Team Submission Link Management ---

export async function addTeamSubmissionLink(
  taskId: string,
  userId: string,
  name: string,
  url: string
) {
  // Verify user is assigned to this team task
  const assignment = await prisma.taskAssignment.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (!assignment) throw new Error('You are not assigned to this task');

  const teamSub = await prisma.teamSubmission.findUnique({ where: { taskId } });
  if (!teamSub) throw new Error('Team submission not found');

  const currentLinks = (teamSub.links as any[]) || [];

  const updated = await prisma.teamSubmission.update({
    where: { taskId },
    data: { links: [...currentLinks, { name, url }] },
  });

  // Broadcast update to all team members
  const assignments = await prisma.taskAssignment.findMany({ where: { taskId }, select: { userId: true } });
  for (const a of assignments) {
    try {
      await broadcast(`user-${a.userId}`, 'team-link-updated', { taskId, name, url, action: 'added' });
    } catch (e) { console.error(e); }
  }

  return updated;
}

export async function removeTeamSubmissionLink(
  taskId: string,
  userId: string,
  index: number
) {
  const assignment = await prisma.taskAssignment.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (!assignment) throw new Error('You are not assigned to this task');

  const teamSub = await prisma.teamSubmission.findUnique({ where: { taskId } });
  if (!teamSub) throw new Error('Team submission not found');

  const currentLinks = [...((teamSub.links as any[]) || [])];

  if (index < 0 || index >= currentLinks.length) throw new Error('Invalid link index');
  currentLinks.splice(index, 1);

  const updated = await prisma.teamSubmission.update({
    where: { taskId },
    data: { links: currentLinks },
  });

  return updated;
}

export async function addTeamSubmissionAttachment(
  taskId: string,
  userId: string,
  url: string
) {
  const assignment = await prisma.taskAssignment.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (!assignment) throw new Error('You are not assigned to this task');

  const teamSub = await prisma.teamSubmission.findUnique({ where: { taskId } });
  if (!teamSub) throw new Error('Team submission not found');

  const updated = await prisma.teamSubmission.update({
    where: { taskId },
    data: { attachments: [...teamSub.attachments, url] },
  });

  return updated;
}

export async function getTeamSubmission(taskId: string, userId: string) {
  // Verify user is assigned
  const assignment = await prisma.taskAssignment.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (!assignment) throw new Error('You are not assigned to this task');

  return prisma.teamSubmission.findUnique({
    where: { taskId },
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

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) throw new Error('Incorrect current password');

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

export async function updateProfile(userId: string, name?: string, avatarData?: string) {
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (avatarData !== undefined) data.avatarData = avatarData;

  await prisma.user.update({
    where: { id: userId },
    data,
  });
}
