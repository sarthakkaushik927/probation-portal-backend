import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import adminRouter from './routes/admin';
import notificationRouter from './routes/notification';
import submissionRouter from './routes/submission';
import chatRouter from './routes/chat';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/user', userRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/submissions', submissionRouter);
  app.use('/api/chat', chatRouter);
  // Backwards-compatibility: accept requests to /chat (no /api prefix)
  app.use('/chat', chatRouter);

  return app;
}
