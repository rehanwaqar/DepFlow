import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import aiRoutes from './routes/ai.js';
import chatRoutes from './routes/chat.js';
import standupRoutes from './routes/standups.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production' || process.env.SERVE_FRONTEND === '1';

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'depflow' }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:id/ai', aiRoutes);
app.use('/api/projects/:id/chat', chatRoutes);
app.use('/api/projects/:id/standups', standupRoutes);
app.use('/api', taskRoutes);

if (isProd) {
  const dist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`DepFlow ${isProd ? 'app' : 'API'} running on http://localhost:${PORT}`);
});
