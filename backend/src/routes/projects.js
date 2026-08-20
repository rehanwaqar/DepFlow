import { Router } from 'express';
import prisma from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { detectBottlenecks } from '../utils/bottlenecks.js';
import {
  assertProjectAccess,
  assertProjectOwner,
  buildProgress,
  logActivity,
  memberInclude,
  taskInclude,
  userPublic,
} from '../utils/access.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.user.userId },
    include: {
      project: {
        include: {
          _count: { select: { tasks: true, members: true } },
          owner: { select: userPublic },
          tasks: { select: { status: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const projects = memberships.map((m) => {
    const progress = buildProgress(m.project.tasks);
    return {
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      createdAt: m.project.createdAt,
      updatedAt: m.project.updatedAt,
      ownerId: m.project.ownerId,
      owner: m.project.owner,
      role: m.role,
      _count: m.project._count,
      progress,
    };
  });

  projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ projects });
});

router.post('/', async (req, res) => {
  const { name, description = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description,
      ownerId: req.user.userId,
      members: {
        create: { userId: req.user.userId, role: 'owner' },
      },
    },
  });

  await logActivity(project.id, req.user.userId, 'project_created', `created project “${project.name}”`);
  res.status(201).json({ project });
});

router.get('/:id', async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: userPublic },
      members: {
        include: memberInclude,
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      },
      tasks: {
        include: taskInclude,
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
      },
      activities: {
        include: { user: { select: userPublic } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  const bottlenecks = detectBottlenecks(project.tasks);
  const progress = buildProgress(project.tasks);
  res.json({
    project,
    bottlenecks,
    progress,
    myRole: access.role,
  });
});

router.patch('/:id', async (req, res) => {
  const access = await assertProjectOwner(req.params.id, req.user.userId);
  if (!access) return res.status(403).json({ error: 'Only the owner can update this project' });

  const { name, description } = req.body;
  const project = await prisma.project.update({
    where: { id: access.project.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
    },
  });
  res.json({ project });
});

router.delete('/:id', async (req, res) => {
  const access = await assertProjectOwner(req.params.id, req.user.userId);
  if (!access) return res.status(403).json({ error: 'Only the owner can delete this project' });
  await prisma.project.delete({ where: { id: access.project.id } });
  res.json({ ok: true });
});

router.get('/:id/members', async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });
  const members = await prisma.projectMember.findMany({
    where: { projectId: req.params.id },
    include: memberInclude,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  res.json({ members });
});

router.post('/:id/members', async (req, res) => {
  const access = await assertProjectOwner(req.params.id, req.user.userId);
  if (!access) return res.status(403).json({ error: 'Only the owner can invite teammates' });

  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({
      error: 'No account with that email. Ask them to register on DepFlow first, then invite again.',
    });
  }

  if (user.id === req.user.userId) {
    return res.status(400).json({ error: 'You are already on this project' });
  }

  try {
    const member = await prisma.projectMember.create({
      data: { projectId: access.project.id, userId: user.id, role: 'member' },
      include: memberInclude,
    });
    await logActivity(
      access.project.id,
      req.user.userId,
      'member_added',
      `invited ${user.name} to the team`
    );
    res.status(201).json({ member });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'User is already a member' });
    console.error(err);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

router.delete('/:id/members/:userId', async (req, res) => {
  const access = await assertProjectOwner(req.params.id, req.user.userId);
  if (!access) return res.status(403).json({ error: 'Only the owner can remove teammates' });

  if (req.params.userId === access.project.ownerId) {
    return res.status(400).json({ error: 'Cannot remove the project owner' });
  }

  const removed = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId: access.project.id, userId: req.params.userId },
    },
    include: { user: { select: userPublic } },
  });
  if (!removed) return res.status(404).json({ error: 'Member not found' });

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: access.project.id, userId: req.params.userId } },
  });
  await prisma.task.updateMany({
    where: { projectId: access.project.id, assigneeId: req.params.userId },
    data: { assigneeId: null },
  });
  await logActivity(
    access.project.id,
    req.user.userId,
    'member_removed',
    `removed ${removed.user.name} from the team`
  );
  res.json({ ok: true });
});

router.get('/:id/bottlenecks', async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.id },
    include: taskInclude,
  });
  res.json({ bottlenecks: detectBottlenecks(tasks) });
});

router.get('/:id/flow', async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.id },
    include: taskInclude,
  });
  const bottlenecks = detectBottlenecks(tasks);
  const bottleneckIds = new Set(bottlenecks.map((b) => b.taskId));

  const nodes = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    isBottleneck: bottleneckIds.has(t.id),
    assignee: t.assignee,
  }));

  const edges = [];
  for (const t of tasks) {
    for (const d of t.dependsOn) {
      edges.push({
        id: d.id,
        source: d.dependencyId,
        target: t.id,
        label: 'blocks',
      });
    }
  }

  res.json({ nodes, edges, bottlenecks });
});

router.get('/:id/activities', async (req, res) => {
  const access = await assertProjectAccess(req.params.id, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });
  const activities = await prisma.activity.findMany({
    where: { projectId: req.params.id },
    include: { user: { select: userPublic } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  res.json({ activities });
});

export default router;
