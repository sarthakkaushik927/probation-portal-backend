import Pusher from 'pusher';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let pusherClient: Pusher | null = null;
let io: SocketIOServer | null = null;

const USE_PUSHER = process.env.USE_PUSHER === 'true';

export function initRealtime(httpServer: HttpServer) {
  if (USE_PUSHER) {
    // Requires PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER in .env
    console.log('🔌 Initializing Pusher for Realtime events');
    if (process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER) {
      pusherClient = new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER,
        useTLS: true
      });
    } else {
      console.warn('⚠️ Missing Pusher environment variables! Realtime events will fail.');
    }
  } else {
    console.log('🔌 Initializing Socket.IO for Realtime events');
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // Adjust this for production
      }
    });

    io.on('connection', (socket) => {
      console.log('🟢 New client connected:', socket.id);
      
      socket.on('join', (channelName) => {
        socket.join(channelName);
      });

      socket.on('disconnect', () => {
        console.log('🔴 Client disconnected:', socket.id);
      });
    });
  }
}

export async function broadcast(channel: string, event: string, data: any) {
  try {
    if (USE_PUSHER && pusherClient) {
      await pusherClient.trigger(channel, event, data);
    } else if (io) {
      io.to(channel).emit(event, data);
    }
  } catch (err) {
    console.error('Realtime Broadcast Error:', err);
  }
}
