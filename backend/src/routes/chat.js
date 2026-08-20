import { Router } from 'express';
import prisma from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { assertProjectAccess, userPublic } from '../utils/access.js';

const router = Router({ mergeParams: true });

router.get('/', authRequired, async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const since = req.query.since ? new Date(String(req.query.since)) : null;
  const messages = await prisma.chatMessage.findMany({
    where: {
      projectId: req.params.id,
      ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}),
    },
    include: { user: { select: { ...userPublic, timezone: true, locationLabel: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json({ messages });
});

router.post('/', authRequired, async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message cannot be empty' });
  if (body.length > 2000) return res.status(400).json({ error: 'Message too long' });

  const message = await prisma.chatMessage.create({
    data: {
      projectId: req.params.id,
      userId: req.user.userId,
      body,
    },
    include: { user: { select: { ...userPublic, timezone: true, locationLabel: true } } },
  });
  res.status(201).json({ message });
});

export default router;
