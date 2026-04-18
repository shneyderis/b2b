import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import addressRoutes from './routes/addresses.js';
import wineRoutes from './routes/wines.js';
import orderRoutes from './routes/orders.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/wines', wineRoutes);
app.use('/api/orders', orderRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});

export default app;
