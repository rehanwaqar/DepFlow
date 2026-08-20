import prisma from '../db.js';

const userPublic = {
  id: true,
  name: true,
  email: true,
  timezone: true,
  locationLabel: true,
  lastSeenAt: true,
};

export { userPublic };
export async function getMembership(projectId, userId) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function assertProjectAccess(projectId, userId) {
  const membership = await getMembership(projectId, userId);
  if (!membership) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  return { project, membership, role: membership.role };
}

export async function assertProjectOwner(projectId, userId) {
  const access = await assertProjectAccess(projectId, userId);
  if (!access || access.role !== 'owner') return null;
  return access;
}

export async function logActivity(projectId, userId, type, message) {
  return prisma.activity.create({
    data: { projectId, userId, type, message },
  });
}

export function buildProgress(tasks) {
  const total = tasks.length;
  const byStatus = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  for (const t of tasks) {
    if (byStatus[t.status] !== undefined) byStatus[t.status] += 1;
  }
  const done = byStatus.done;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent, byStatus };
}

export const taskInclude = {
  assignee: { select: userPublic },
  dependsOn: { include: { dependency: { select: { id: true, title: true, status: true } } } },
  dependedOnBy: { include: { dependent: { select: { id: true, title: true, status: true } } } },
};

export const memberInclude = {
  user: { select: userPublic },
};
