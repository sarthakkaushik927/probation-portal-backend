import { prisma } from '../lib/prisma';
import { Domain, AttendanceStatus, TaskType } from '@prisma/client';
import { sendPushNotification } from './notification.service';
import { broadcast } from '../lib/realtime';

export async function getDashboardStats() {
  const [totalUsers, activeTasks, pendingReviews, approvedCount, rejectedCount] = await Promise.all([
    prisma.user.count(),
    prisma.task.count(),
    prisma.submission.count({ where: { status: 'PENDING' } }),
    prisma.submission.count({ where: { status: 'APPROVED' } }),
    prisma.submission.count({ where: { status: 'REJECTED' } }),
  ]);

  return { totalUsers, activeTasks, pendingReviews, approvedCount, rejectedCount };
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

export async function searchUsers(query: string) {
  return prisma.user.findMany({
    where: {
      role: 'USER',
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      domain: true,
      avatarData: true,
    },
    take: 20,
    orderBy: { name: 'asc' },
  });
}

export async function getAllTasks() {
  return prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      assignedUsers: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarData: true, domain: true },
          },
        },
      },
      teamSubmission: true,
    },
  });
}

export async function createTask(
  title: string,
  description: string,
  domain: string,
  deadline: string,
  attachments?: string[],
  type: TaskType = 'INDIVIDUAL',
  teamName?: string,
  assignedUserIds?: string[]
) {
  const task = await prisma.task.create({
    data: {
      title,
      description,
      domain: domain as Domain,
      deadline: new Date(deadline),
      attachments: attachments || [],
      type,
      teamName: type === 'TEAM' ? teamName : null,
    },
  });

  // For team tasks: create assignments and empty team submission
  if (type === 'TEAM' && assignedUserIds && assignedUserIds.length > 0) {
    await prisma.taskAssignment.createMany({
      data: assignedUserIds.map(userId => ({
        taskId: task.id,
        userId,
      })),
    });

    await prisma.teamSubmission.create({
      data: { taskId: task.id },
    });

    // Send notifications to assigned members
    const assignedUsers = await prisma.user.findMany({
      where: { id: { in: assignedUserIds } },
      select: { id: true, expoPushToken: true },
    });

    const notificationData = assignedUsers.map(user => ({
      userId: user.id,
      title: 'New Team Task Assigned',
      body: `You've been assigned to team task "${title}" (Team: ${teamName || 'Unnamed'}).`,
      type: 'TASK_ASSIGNED' as const,
    }));
    await prisma.notification.createMany({ data: notificationData });

    // Send push notifications
    const pushTokens = assignedUsers
      .map(u => u.expoPushToken)
      .filter((token): token is string => !!token && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')));

    for (const token of pushTokens) {
      try {
        await sendPushNotification(token, 'New Team Task Assigned 📋', `You've been assigned to "${title}" (Team: ${teamName || 'Unnamed'}).`, { type: 'TASK_ASSIGNED', taskId: task.id, url: '/(user)/tasks' });
      } catch (e) { console.error(e); }
    }

    // Broadcast realtime event to assigned users
    for (const userId of assignedUserIds) {
      try {
        await broadcast(`user-${userId}`, 'task-assigned', { taskId: task.id, title, teamName });
      } catch (e) { console.error(e); }
    }
  } else {
    // Individual task — send push notification to users in this domain (or all if COMMON)
    const users = await prisma.user.findMany({
      where: {
        ...(domain !== 'COMMON' ? { domain: domain as Domain } : {}),
        expoPushToken: { not: null }
      },
      select: { id: true, expoPushToken: true }
    });

    // Create in-app notifications
    const notificationData = users.map(user => ({
      userId: user.id,
      title: 'New Task Assigned',
      body: `A new task "${title}" has been assigned to your domain.`,
      type: 'TASK_ASSIGNED' as const,
    }));
    await prisma.notification.createMany({ data: notificationData });

    const pushTokens = users.map(u => u.expoPushToken!).filter(token => token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')));
    for (const token of pushTokens) {
      try {
        await sendPushNotification(token, 'New Task Assigned 📋', `A new task "${title}" has been assigned to your domain.`, { type: 'TASK_ASSIGNED', taskId: task.id, url: '/(user)/tasks' });
      } catch (e) { console.error(e); }
    }

    // Broadcast realtime event
    for (const user of users) {
      try {
        await broadcast(`user-${user.id}`, 'task-assigned', { taskId: task.id, title });
      } catch (e) { console.error(e); }
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

export async function addTaskAssignment(taskId: string, userId: string) {
  const assignment = await prisma.taskAssignment.create({
    data: { taskId, userId },
    include: { user: { select: { id: true, name: true, email: true, expoPushToken: true } } },
  });

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true, teamName: true } });

  // Notify the assigned user
  await prisma.notification.create({
    data: {
      userId,
      title: 'Added to Team Task',
      body: `You've been added to "${task?.title}" (Team: ${task?.teamName || 'Unnamed'}).`,
      type: 'TASK_ASSIGNED',
    },
  });

  if (assignment.user.expoPushToken) {
    try {
      await sendPushNotification(assignment.user.expoPushToken, 'Added to Team Task 📋', `You've been added to "${task?.title}".`, { type: 'TASK_ASSIGNED', taskId, url: '/(user)/tasks' });
    } catch (e) { console.error(e); }
  }

  try {
    await broadcast(`user-${userId}`, 'task-assigned', { taskId, title: task?.title });
  } catch (e) { console.error(e); }

  return assignment;
}

export async function removeTaskAssignment(taskId: string, userId: string) {
  await prisma.taskAssignment.delete({
    where: { taskId_userId: { taskId, userId } },
  });
}

export async function getAllSubmissions() {
  const [individual, team] = await Promise.all([
    prisma.submission.findMany({
      include: { user: true, task: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.teamSubmission.findMany({
      include: { task: { include: { assignedUsers: { include: { user: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
  ]);

  const mappedTeam = team.map(ts => ({
    id: ts.id,
    taskId: ts.taskId,
    isTeam: true,
    task: ts.task,
    status: ts.status,
    remarks: ts.remarks,
    links: ts.links,
    attachments: ts.attachments,
    createdAt: ts.createdAt,
    updatedAt: ts.updatedAt,
    user: {
      id: 'team',
      name: `Team (${ts.task.teamName || 'Task'})`,
      email: '',
      avatarData: null,
      members: ts.task.assignedUsers.map(a => a.user)
    }
  }));

  return [...individual, ...mappedTeam].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getSubmissionById(submissionId: string) {
  const individual = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { user: true, task: true },
  });

  if (individual) {
    return individual;
  }

  const teamSub = await prisma.teamSubmission.findUnique({
    where: { id: submissionId },
    include: { task: { include: { assignedUsers: { include: { user: true } } } } },
  });

  if (!teamSub) return null;

  return {
    id: teamSub.id,
    taskId: teamSub.taskId,
    isTeam: true,
    task: teamSub.task,
    status: teamSub.status,
    remarks: teamSub.remarks,
    links: teamSub.links,
    attachments: teamSub.attachments,
    createdAt: teamSub.createdAt,
    updatedAt: teamSub.updatedAt,
    user: {
      id: 'team',
      name: `Team (${teamSub.task.teamName || 'Task'})`,
      email: '',
      avatarData: null,
      members: teamSub.task.assignedUsers.map(a => a.user)
    }
  };
}

export async function approveSubmission(submissionId: string) {
  const individual = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { user: true, task: true }
  });

  if (individual) {
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'APPROVED' },
      include: { user: true, task: true }
    });

    if (submission.user.expoPushToken) {
      await sendPushNotification(
        submission.user.expoPushToken, 
        'Submission Approved! ✅', 
        `Your submission for "${submission.task.title}" was approved.`,
        { type: 'SUBMISSION_STATUS', submissionId, url: '/(user)/submissions' }
      );
    }
    try {
      await broadcast(`user-${submission.userId}`, 'submission-status', { submissionId, status: 'APPROVED', taskTitle: submission.task.title });
    } catch (e) { console.error(e); }
    return submission;
  }

  // Handle Team Submission
  const teamSub = await prisma.teamSubmission.update({
    where: { id: submissionId },
    data: { status: 'APPROVED' },
    include: { task: { include: { assignedUsers: { include: { user: true } } } } }
  });

  for (const assignment of teamSub.task.assignedUsers) {
    if (assignment.user.expoPushToken) {
      try {
        await sendPushNotification(assignment.user.expoPushToken, 'Team Submission Approved! ✅', `Your team's submission for "${teamSub.task.title}" was approved.`, { type: 'SUBMISSION_STATUS', submissionId });
      } catch (e) {}
    }
    try {
      await broadcast(`user-${assignment.userId}`, 'submission-status', { submissionId, status: 'APPROVED', taskTitle: teamSub.task.title });
    } catch (e) {}
  }
  return teamSub;
}

export async function rejectSubmission(submissionId: string) {
  const individual = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { user: true, task: true }
  });

  if (individual) {
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'REJECTED' },
      include: { user: true, task: true }
    });

    if (submission.user.expoPushToken) {
      await sendPushNotification(
        submission.user.expoPushToken, 
        'Submission Rejected ❌', 
        `Your submission for "${submission.task.title}" needs work.`,
        { type: 'SUBMISSION_STATUS', submissionId, url: '/(user)/submissions' }
      );
    }
    try {
      await broadcast(`user-${submission.userId}`, 'submission-status', { submissionId, status: 'REJECTED', taskTitle: submission.task.title });
    } catch (e) { console.error(e); }
    return submission;
  }

  // Handle Team Submission
  const teamSub = await prisma.teamSubmission.update({
    where: { id: submissionId },
    data: { status: 'REJECTED' },
    include: { task: { include: { assignedUsers: { include: { user: true } } } } }
  });

  for (const assignment of teamSub.task.assignedUsers) {
    if (assignment.user.expoPushToken) {
      try {
        await sendPushNotification(assignment.user.expoPushToken, 'Team Submission Rejected ❌', `Your team's submission for "${teamSub.task.title}" needs work.`, { type: 'SUBMISSION_STATUS', submissionId });
      } catch (e) {}
    }
    try {
      await broadcast(`user-${assignment.userId}`, 'submission-status', { submissionId, status: 'REJECTED', taskTitle: teamSub.task.title });
    } catch (e) {}
  }
  return teamSub;
}

export async function approveTeamSubmission(taskId: string) {
  const teamSub = await prisma.teamSubmission.update({
    where: { taskId },
    data: { status: 'APPROVED' },
  });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedUsers: { include: { user: { select: { id: true, expoPushToken: true } } } } },
  });

  if (task) {
    const notificationData = task.assignedUsers.map(a => ({
      userId: a.userId,
      title: 'Team Submission Approved! ✅',
      body: `Your team's submission for "${task.title}" was approved.`,
      type: 'SUBMISSION_STATUS' as const,
    }));
    await prisma.notification.createMany({ data: notificationData });

    for (const assignment of task.assignedUsers) {
      if (assignment.user.expoPushToken) {
        try {
          await sendPushNotification(assignment.user.expoPushToken, 'Team Submission Approved! ✅', `Your team's submission for "${task.title}" was approved.`, { type: 'SUBMISSION_STATUS', taskId });
        } catch (e) { console.error(e); }
      }
      try {
        await broadcast(`user-${assignment.userId}`, 'submission-status', { taskId, status: 'APPROVED', taskTitle: task.title });
      } catch (e) { console.error(e); }
    }
  }

  return teamSub;
}

export async function rejectTeamSubmission(taskId: string) {
  const teamSub = await prisma.teamSubmission.update({
    where: { taskId },
    data: { status: 'REJECTED' },
  });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedUsers: { include: { user: { select: { id: true, expoPushToken: true } } } } },
  });

  if (task) {
    const notificationData = task.assignedUsers.map(a => ({
      userId: a.userId,
      title: 'Team Submission Rejected ❌',
      body: `Your team's submission for "${task.title}" needs work.`,
      type: 'SUBMISSION_STATUS' as const,
    }));
    await prisma.notification.createMany({ data: notificationData });

    for (const assignment of task.assignedUsers) {
      if (assignment.user.expoPushToken) {
        try {
          await sendPushNotification(assignment.user.expoPushToken, 'Team Submission Rejected ❌', `Your team's submission for "${task.title}" needs work.`, { type: 'SUBMISSION_STATUS', taskId });
        } catch (e) { console.error(e); }
      }
      try {
        await broadcast(`user-${assignment.userId}`, 'submission-status', { taskId, status: 'REJECTED', taskTitle: task.title });
      } catch (e) { console.error(e); }
    }
  }

  return teamSub;
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

  // Broadcast attendance updates to affected users
  for (const record of records) {
    try {
      await broadcast(`user-${record.userId}`, 'attendance-updated', { date, status: record.status });
    } catch (e) { console.error(e); }
  }
}
