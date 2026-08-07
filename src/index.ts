import 'dotenv/config';
import { createApp } from './app';

const PORT = process.env.PORT || 4000;

const app = createApp();

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Probation Portal API running → http://localhost:${PORT}`);
  });
}

export default app;
