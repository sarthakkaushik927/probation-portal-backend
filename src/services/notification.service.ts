import { Expo } from 'expo-server-sdk';
import prisma from '../lib/prisma';

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
const expo = new Expo();

export async function sendPushNotification(pushToken: string, title: string, body: string, data: any = {}) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages = [{
    to: pushToken,
    sound: 'default' as 'default',
    title,
    body,
    data,
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

export async function broadcastPushNotification(title: string, body: string, data: any = {}) {
  // Get all users with push tokens
  const users = await prisma.user.findMany({
    where: {
      expoPushToken: { not: null },
    },
    select: { expoPushToken: true },
  });

  const pushTokens = users.map(u => u.expoPushToken!).filter(token => Expo.isExpoPushToken(token));
  
  if (pushTokens.length === 0) return;

  const messages = pushTokens.map(token => ({
    to: token,
    sound: 'default' as 'default',
    title,
    body,
    data,
  }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.error('Error broadcasting push notifications:', error);
  }
}
