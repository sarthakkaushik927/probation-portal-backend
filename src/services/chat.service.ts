import { prisma } from '../lib/prisma';

export async function getRecentMessages(limit = 50) {
  return prisma.message.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          avatarData: true,
        },
      },
    },
  });
}

export async function saveMessage(userId: string, content: string) {
  return prisma.message.create({
    data: {
      userId,
      content,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          avatarData: true,
        },
      },
    },
  });
}
