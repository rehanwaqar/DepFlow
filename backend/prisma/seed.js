import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.standupCheckIn.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('demo1234', 10);

  const alex = await prisma.user.create({
    data: {
      email: 'demo@depflow.app',
      name: 'Alex Rivera',
      passwordHash,
      timezone: 'America/Los_Angeles',
      locationLabel: 'San Francisco, US',
    },
  });
  const jordan = await prisma.user.create({
    data: {
      email: 'jordan@depflow.app',
      name: 'Jordan Lee',
      passwordHash,
      timezone: 'Europe/London',
      locationLabel: 'London, UK',
    },
  });
  const sam = await prisma.user.create({
    data: {
      email: 'sam@depflow.app',
      name: 'Sam Okonkwo',
      passwordHash,
      timezone: 'Africa/Lagos',
      locationLabel: 'Lagos, NG',
    },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Product Launch',
      description: 'Global team shipping DepFlow together across timezones',
      ownerId: alex.id,
      members: {
        create: [
          { userId: alex.id, role: 'owner' },
          { userId: jordan.id, role: 'member' },
          { userId: sam.id, role: 'member' },
        ],
      },
    },
  });

  const titles = [
    { title: 'Define requirements', status: 'done', priority: 'high', position: 0, assigneeId: alex.id },
    { title: 'Design system & wireframes', status: 'done', priority: 'high', position: 1, assigneeId: jordan.id },
    { title: 'Set up auth API', status: 'in_progress', priority: 'high', position: 0, assigneeId: alex.id },
    { title: 'Build project CRUD', status: 'todo', priority: 'medium', position: 0, assigneeId: sam.id },
    { title: 'Task dependency engine', status: 'todo', priority: 'high', position: 1, assigneeId: alex.id },
    { title: 'Kanban board UI', status: 'todo', priority: 'medium', position: 2, assigneeId: jordan.id },
    { title: 'Dependency flow graph', status: 'blocked', priority: 'medium', position: 0, assigneeId: jordan.id },
    { title: 'Bottleneck detection', status: 'todo', priority: 'high', position: 3, assigneeId: sam.id },
    { title: 'QA & polish', status: 'todo', priority: 'low', position: 4, assigneeId: sam.id },
    { title: 'Launch checklist', status: 'todo', priority: 'medium', position: 5, assigneeId: alex.id },
  ];

  const tasks = [];
  for (const t of titles) {
    tasks.push(
      await prisma.task.create({
        data: {
          ...t,
          description: `${t.title} for the shared DepFlow launch.`,
          projectId: project.id,
        },
      })
    );
  }

  const edges = [
    [2, 0],
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 3],
    [6, 4],
    [7, 4],
    [8, 5],
    [8, 6],
    [8, 7],
    [9, 8],
  ];

  for (const [depIdx, dependencyIdx] of edges) {
    await prisma.taskDependency.create({
      data: {
        dependentId: tasks[depIdx].id,
        dependencyId: tasks[dependencyIdx].id,
      },
    });
  }

  await prisma.activity.createMany({
    data: [
      {
        projectId: project.id,
        userId: alex.id,
        type: 'project_created',
        message: 'created project “Product Launch”',
      },
      {
        projectId: project.id,
        userId: alex.id,
        type: 'member_added',
        message: 'invited Jordan Lee to the team',
      },
      {
        projectId: project.id,
        userId: alex.id,
        type: 'member_added',
        message: 'invited Sam Okonkwo to the team',
      },
      {
        projectId: project.id,
        userId: jordan.id,
        type: 'status_changed',
        message: 'moved “Design system & wireframes” to done',
      },
    ],
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        projectId: project.id,
        userId: alex.id,
        body: 'Morning SF here — auth API is in progress. London/Lagos, can you take CRUD + QA once auth lands?',
      },
      {
        projectId: project.id,
        userId: jordan.id,
        body: 'London afternoon — design is done. I’ll jump on Kanban after CRUD. Starting a call if we need to unblock the flow graph.',
      },
      {
        projectId: project.id,
        userId: sam.id,
        body: 'Lagos evening — I can own CRUD + bottleneck detection. Dropping my async standup now.',
      },
    ],
  });

  await prisma.standupCheckIn.createMany({
    data: [
      {
        projectId: project.id,
        userId: alex.id,
        yesterday: 'Finalized requirements and kicked off auth.',
        today: 'Finish auth API endpoints and hand off to Sam.',
        blockers: 'Waiting on one design token from Jordan.',
      },
      {
        projectId: project.id,
        userId: jordan.id,
        yesterday: 'Shipped wireframes and design system basics.',
        today: 'Prep Kanban UI and review dependency graph blockers.',
        blockers: 'Flow graph blocked on dependency engine.',
      },
      {
        projectId: project.id,
        userId: sam.id,
        yesterday: 'Reviewed project structure.',
        today: 'Start project CRUD and sketch bottleneck checks.',
        blockers: 'Need auth API before full integration test.',
      },
    ],
  });

  console.log('Seeded global demo team (password: demo1234)');
  console.log('  demo@depflow.app   — Alex · San Francisco');
  console.log('  jordan@depflow.app — Jordan · London');
  console.log('  sam@depflow.app    — Sam · Lagos');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
