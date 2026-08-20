import { Router } from 'express';
import prisma from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { assertProjectAccess, userPublic } from '../utils/access.js';

const router = Router({ mergeParams: true });

router.get('/', authRequired, async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const checkIns = await prisma.standupCheckIn.findMany({
    where: { projectId: req.params.id },
    include: { user: { select: { ...userPublic, timezone: true, locationLabel: true } } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  res.json({ checkIns });
});

router.post('/', authRequired, async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const yesterday = String(req.body?.yesterday || '').trim();
  const today = String(req.body?.today || '').trim();
  const blockers = String(req.body?.blockers || '').trim();
  if (!today) return res.status(400).json({ error: 'Today’s plan is required' });

  const checkIn = await prisma.standupCheckIn.create({
    data: {
      projectId: req.params.id,
      userId: req.user.userId,
      yesterday,
      today,
      blockers,
    },
    include: { user: { select: { ...userPublic, timezone: true, locationLabel: true } } },
  });
  res.status(201).json({ checkIn });
});

export default router;
