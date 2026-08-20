import { Router } from 'express';
import prisma from '../db.js';
import { authRequired } from '../middleware/auth.js';
import {
  assertProjectAccess,
  logActivity,
  taskInclude,
  userPublic,
} from '../utils/access.js';
import { buildAiInsights } from '../utils/aiCoach.js';

const router = Router({ mergeParams: true });

router.get('/insights', authRequired, async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: { select: { ...userPublic, timezone: true, locationLabel: true, lastSeenAt: true } } } },
      tasks: { include: taskInclude },
      checkIns: {
        include: { user: { select: { ...userPublic, timezone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
  });

  const insights = buildAiInsights({
    project,
    tasks: project.tasks,
    members: project.members,
    checkIns: project.checkIns,
  });
  res.json({ insights });
});

router.post('/apply-todos', authRequired, async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: true } },
      tasks: { include: taskInclude },
      checkIns: { include: { user: true }, orderBy: { createdAt: 'desc' }, take: 12 },
    },
  });

  const insights = buildAiInsights({
    project,
    tasks: project.tasks,
    members: project.members,
    checkIns: project.checkIns,
  });

  const selected = Array.isArray(req.body?.titles)
    ? insights.suggestedTodos.filter((t) => req.body.titles.includes(t.title))
    : insights.suggestedTodos;

  const created = [];
  for (const suggestion of selected) {
    const exists = project.tasks.some(
      (t) => t.title.toLowerCase() === suggestion.title.toLowerCase()
    );
    if (exists) continue;
    const maxPos = await prisma.task.aggregate({
      where: { projectId: project.id, status: 'todo' },
      _max: { position: true },
    });
    const task = await prisma.task.create({
      data: {
        title: suggestion.title,
        description: suggestion.description,
        priority: suggestion.priority,
        status: 'todo',
        position: (maxPos._max.position ?? -1) + 1,
        projectId: project.id,
      },
      include: taskInclude,
    });
    created.push(task);
  }

  if (created.length) {
    await logActivity(
      project.id,
      req.user.userId,
      'ai_todos',
      `applied ${created.length} AI-suggested todo${created.length === 1 ? '' : 's'}`
    );
  }

  res.status(201).json({ created, count: created.length });
});

router.post('/apply-rebalance', authRequired, async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: true } },
      tasks: { include: taskInclude },
      checkIns: { include: { user: true }, take: 5 },
    },
  });

  const insights = buildAiInsights({
    project,
    tasks: project.tasks,
    members: project.members,
    checkIns: project.checkIns,
  });

  const moves = insights.rebalance || [];
  const updated = [];
  for (const move of moves) {
    const task = await prisma.task.update({
      where: { id: move.taskId },
      data: { assigneeId: move.toUserId },
      include: taskInclude,
    });
    updated.push(task);
  }

  if (updated.length) {
    await logActivity(
      project.id,
      req.user.userId,
      'ai_rebalance',
      `applied AI work split (${updated.length} assignment${updated.length === 1 ? '' : 's'})`
    );
  }

  res.json({ updated, moves, count: updated.length });
});

router.get('/call', authRequired, async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const room = `DepFlow-${req.params.id}`.replace(/[^a-zA-Z0-9-_]/g, '');
  const url = `https://meet.jit.si/${room}`;
  await logActivity(req.params.id, req.user.userId, 'call_started', 'started a team call room');
  res.json({
    provider: 'jitsi',
    room,
    url,
    note: 'Works for teammates worldwide — open the link to join audio/video.',
  });
});

export default router;
