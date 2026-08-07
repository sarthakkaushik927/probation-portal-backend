const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    console.log('users:', users.length);
    const n = await prisma.notification.createMany({
      data: users.map(u => ({
        title: 'test',
        message: 'test',
        type: 'MANUAL',
        userId: u.id
      }))
    });
    console.log(n);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
