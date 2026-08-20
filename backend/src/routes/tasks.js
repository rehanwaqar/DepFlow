import { Router } from 'express';
import prisma from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { wouldCreateCycle } from '../utils/bottlenecks.js';
import { assertProjectAccess, logActivity, taskInclude } from '../utils/access.js';

const router = Router();
router.use(authRequired);

const STATUSES = ['todo', 'in_progress', 'blocked', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

async function assertTaskAccess(taskId, userId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) return null;
  const access = await assertProjectAccess(task.projectId, userId);
  if (!access) return null;
  return { task, access };
}

async function resolveAssignee(projectId, assigneeId) {
  if (assigneeId === null || assigneeId === '') return null;
  if (!assigneeId) return undefined;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
  });
  if (!member) throw Object.assign(new Error('Assignee must be a project member'), { status: 400 });
  return assigneeId;
}

router.post('/projects/:projectId/tasks', async (req, res) => {
  try {
    const access = await assertProjectAccess(req.params.projectId, req.user.userId);
    if (!access) return res.status(404).json({ error: 'Project not found' });

    const {
      title,
      description = '',
      status = 'todo',
      priority = 'medium',
      dependencyIds = [],
      assigneeId = null,
    } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Task title is required' });
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

    let resolvedAssignee;
    try {
      resolvedAssignee = await resolveAssignee(access.project.id, assigneeId);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const maxPos = await prisma.task.aggregate({
      where: { projectId: access.project.id, status },
      _max: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description,
        status,
        priority,
        position: (maxPos._max.position ?? -1) + 1,
        projectId: access.project.id,
        assigneeId: resolvedAssignee ?? null,
      },
    });

    if (Array.isArray(dependencyIds) && dependencyIds.length) {
      const projectTasks = await prisma.task.findMany({
        where: { projectId: access.project.id },
        include: { dependsOn: true },
      });
      for (const depId of dependencyIds) {
        if (depId === task.id) continue;
        const exists = projectTasks.some((t) => t.id === depId);
        if (!exists) continue;
        if (wouldCreateCycle(projectTasks, task.id, depId)) continue;
        await prisma.taskDependency.create({
          data: { dependentId: task.id, dependencyId: depId },
        });
      }
    }

    await logActivity(
      access.project.id,
      req.user.userId,
      'task_created',
      `added task “${task.title}”`
    );

    const full = await prisma.task.findUnique({ where: { id: task.id }, include: taskInclude });
    res.status(201).json({ task: full });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.patch('/tasks/:id', async (req, res) => {
  try {
    const found = await assertTaskAccess(req.params.id, req.user.userId);
    if (!found) return res.status(404).json({ error: 'Task not found' });

    const { title, description, status, priority, position, assigneeId } = req.body;
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (priority !== undefined && !PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    let resolvedAssignee;
    if (assigneeId !== undefined) {
      try {
        resolvedAssignee = await resolveAssignee(found.task.projectId, assigneeId);
      } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
    }

    const task = await prisma.task.update({
      where: { id: found.task.id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(position !== undefined ? { position: Number(position) } : {}),
        ...(assigneeId !== undefined ? { assigneeId: resolvedAssignee } : {}),
      },
      include: taskInclude,
    });

    if (status !== undefined && status !== found.task.status) {
      await logActivity(
        found.task.projectId,
        req.user.userId,
        'status_changed',
        `moved “${task.title}” to ${status.replace('_', ' ')}`
      );
    } else if (title !== undefined || assigneeId !== undefined) {
      await logActivity(
        found.task.projectId,
        req.user.userId,
        'task_updated',
        `updated “${task.title}”`
      );
    }

    res.json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  const found = await assertTaskAccess(req.params.id, req.user.userId);
  if (!found) return res.status(404).json({ error: 'Task not found' });
  const title = found.task.title;
  await prisma.task.delete({ where: { id: found.task.id } });
  await logActivity(found.task.projectId, req.user.userId, 'task_deleted', `deleted “${title}”`);
  res.json({ ok: true });
});

router.post('/tasks/:id/dependencies', async (req, res) => {
  try {
    const { dependencyId } = req.body;
    if (!dependencyId) return res.status(400).json({ error: 'dependencyId is required' });

    const found = await assertTaskAccess(req.params.id, req.user.userId);
    if (!found) return res.status(404).json({ error: 'Task not found' });

    const dependency = await prisma.task.findFirst({
      where: { id: dependencyId, projectId: found.task.projectId },
    });
    if (!dependency) return res.status(404).json({ error: 'Dependency task not found' });

    const projectTasks = await prisma.task.findMany({
      where: { projectId: found.task.projectId },
      include: { dependsOn: true },
    });

    if (wouldCreateCycle(projectTasks, found.task.id, dependencyId)) {
      return res.status(400).json({ error: 'Adding this dependency would create a cycle' });
    }

    const edge = await prisma.taskDependency.create({
      data: { dependentId: found.task.id, dependencyId },
    });
    const full = await prisma.task.findUnique({ where: { id: found.task.id }, include: taskInclude });
    res.status(201).json({ dependency: edge, task: full });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Dependency already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to add dependency' });
  }
});

router.delete('/tasks/:id/dependencies/:dependencyId', async (req, res) => {
  const found = await assertTaskAccess(req.params.id, req.user.userId);
  if (!found) return res.status(404).json({ error: 'Task not found' });
  await prisma.taskDependency.deleteMany({
    where: { dependentId: found.task.id, dependencyId: req.params.dependencyId },
  });
  res.json({ ok: true });
});

router.post('/projects/:projectId/reorder', async (req, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.user.userId);
  if (!access) return res.status(404).json({ error: 'Project not found' });

  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' });

  await prisma.$transaction(
    updates.map((u) =>
      prisma.task.updateMany({
        where: { id: u.id, projectId: access.project.id },
        data: {
          ...(u.status ? { status: u.status } : {}),
          ...(u.position !== undefined ? { position: u.position } : {}),
        },
      })
    )
  );

  const tasks = await prisma.task.findMany({
    where: { projectId: access.project.id },
    include: taskInclude,
    orderBy: [{ status: 'asc' }, { position: 'asc' }],
  });
  res.json({ tasks });
});

export default router;
