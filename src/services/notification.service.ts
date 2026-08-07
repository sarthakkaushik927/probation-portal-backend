import prisma from '../lib/prisma';

// Native fetch implementation for Expo Push Notifications
async function sendExpoPushTokens(messages: any[]) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    
    if (!response.ok) {
      console.error('Expo Push API Error:', await response.text());
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

function isExpoPushToken(token: string) {
  return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

export async function sendPushNotification(pushToken: string, title: string, body: string, data: any = {}) {
  if (!isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages = [{
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  }];

  await sendExpoPushTokens(messages);
}

export async function broadcastPushNotification(title: string, body: string, data: any = {}) {
  // Get all users with push tokens
  const users = await prisma.user.findMany({
    where: {
      expoPushToken: { not: null },
    },
    select: { expoPushToken: true },
  });

  const pushTokens = users.map(u => u.expoPushToken!).filter(isExpoPushToken);
  
  if (pushTokens.length === 0) return;

  const messages = pushTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  // Chunk messages into groups of 100 as per Expo guidelines
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    await sendExpoPushTokens(chunk);
  }
}
