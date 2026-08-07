import 'dotenv/config';
import { createApp } from './app';

import { createServer } from 'http';
import { initRealtime } from './lib/realtime';

const PORT = process.env.PORT || 4000;

const app = createApp();
const httpServer = createServer(app);

// Initialize Socket.IO or Pusher
initRealtime(httpServer);

if (process.env.NODE_ENV !== 'production') {
  httpServer.listen(PORT, () => {
    console.log(`✅ Probation Portal API running → http://localhost:${PORT}`);
  });
}

export default app;
