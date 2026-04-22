import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import addressRoutes from './routes/addresses.js';
import wineRoutes from './routes/wines.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import warehouseRoutes from './routes/warehouse.js';
import telegramWebhookRoutes from './routes/telegramWebhook.js';
import cronRoutes from './routes/cron.js';

export function createApp() {
  const app = express();
  app.use(cors());

  // Voice / image upload endpoints carry base64-encoded payloads (~5-10MB
  // for a phone photo). Mount the large-body parser on these paths
  // explicitly so the other routes keep a tight 1MB attack surface.
  const bigJson = express.json({ limit: '12mb' });
  app.use('/api/orders/parse-voice', bigJson);
  app.use('/api/orders/parse-image', bigJson);
  app.use('/api/admin/orders/parse-voice', bigJson);
  app.use('/api/admin/orders/parse-image', bigJson);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/addresses', addressRoutes);
  app.use('/api/wines', wineRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/warehouse', warehouseRoutes);
  app.use('/api/telegram', telegramWebhookRoutes);
  app.use('/api/cron', cronRoutes);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'internal error' });
  });

  return app;
}
