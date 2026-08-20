import { detectBottlenecks } from './bottlenecks.js';

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };
const OVERLOAD_SCORE = 8;

function openTasks(tasks) {
  return tasks.filter((t) => t.status !== 'done');
}

function isUnblocked(task, byId) {
  const deps = task.dependsOn || [];
  return deps.every((d) => {
    const dep = byId.get(d.dependencyId);
    return !dep || dep.status === 'done';
  });
}

function workloadFor(memberId, tasks) {
  const assigned = openTasks(tasks).filter((t) => t.assigneeId === memberId);
  const score = assigned.reduce((sum, t) => sum + (PRIORITY_WEIGHT[t.priority] || 1), 0);
  return {
    openCount: assigned.length,
    highCount: assigned.filter((t) => t.priority === 'high').length,
    blockedCount: assigned.filter((t) => t.status === 'blocked').length,
    inProgressCount: assigned.filter((t) => t.status === 'in_progress').length,
    score,
    overloaded: score >= OVERLOAD_SCORE || assigned.length >= 4,
    tasks: assigned.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
  };
}

function buildSuggestedTodos(project, tasks, members, bottlenecks) {
  const titles = new Set(tasks.map((t) => t.title.toLowerCase()));
  const suggestions = [];
  const has = (kw) => [...titles].some((t) => t.includes(kw));

  if (!has('test') && !has('qa')) {
    suggestions.push({
      title: 'Write regression test checklist',
      description: 'AI suggestion: lock quality before launch with a shared QA checklist.',
      priority: 'medium',
      reason: 'No testing/QA task found',
    });
  }
  if (!has('doc') && !has('readme')) {
    suggestions.push({
      title: 'Document handoff for remote teammates',
      description: 'AI suggestion: short setup + ownership notes so distributed teammates can move fast.',
      priority: 'low',
      reason: 'Distributed teams need clear handoff docs',
    });
  }
  if (bottlenecks.length && !has('unblock')) {
    suggestions.push({
      title: `Unblock: ${bottlenecks[0].title}`,
      description: `AI suggestion: focus swarm on “${bottlenecks[0].title}” — ${bottlenecks[0].reasons[0] || 'critical path'}.`,
      priority: 'high',
      reason: 'Top bottleneck needs explicit focus',
    });
  }
  if (openTasks(tasks).some((t) => !t.assigneeId)) {
    suggestions.push({
      title: 'Assign owners to unowned tasks',
      description: 'AI suggestion: every open task should have a clear owner across timezones.',
      priority: 'medium',
      reason: 'Unassigned work stalls remote collaboration',
    });
  }
  if (members.length >= 2 && !has('sync') && !has('standup')) {
    suggestions.push({
      title: 'Async standup ritual (timezone-friendly)',
      description: 'AI suggestion: post daily check-ins in Chat so global teammates stay aligned without live meetings.',
      priority: 'low',
      reason: 'Help worldwide teammates share progress',
    });
  }
  return suggestions.slice(0, 5);
}

function suggestRebalance(workloads, tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const overloaded = workloads.filter((w) => w.overloaded).sort((a, b) => b.score - a.score);
  const under = workloads.filter((w) => !w.overloaded).sort((a, b) => a.score - b.score);
  const moves = [];

  for (const heavy of overloaded) {
    const movable = heavy.tasks
      .filter((t) => t.status === 'todo')
      .sort((a, b) => (PRIORITY_WEIGHT[a.priority] || 1) - (PRIORITY_WEIGHT[b.priority] || 1));
    for (const task of movable) {
      const target = under[0];
      if (!target || target.userId === heavy.userId) break;
      if (target.score + (PRIORITY_WEIGHT[task.priority] || 1) >= OVERLOAD_SCORE) break;
      moves.push({
        taskId: task.id,
        title: task.title,
        fromUserId: heavy.userId,
        fromName: heavy.name,
        toUserId: target.userId,
        toName: target.name,
        reason: `${heavy.name} is overloaded; ${target.name} has capacity`,
      });
      target.score += PRIORITY_WEIGHT[task.priority] || 1;
      heavy.score -= PRIORITY_WEIGHT[task.priority] || 1;
      if (moves.length >= 4) return moves;
    }
  }

  // Also assign unassigned ready work to lightest load
  const unassigned = openTasks(tasks).filter((t) => !t.assigneeId && isUnblocked(t, byId));
  const light = [...workloads].sort((a, b) => a.score - b.score);
  for (const task of unassigned.slice(0, 3)) {
    const target = light[0];
    if (!target) break;
    moves.push({
      taskId: task.id,
      title: task.title,
      fromUserId: null,
      fromName: 'Unassigned',
      toUserId: target.userId,
      toName: target.name,
      reason: 'Ready work with no owner — assign to available teammate',
    });
    target.score += PRIORITY_WEIGHT[task.priority] || 1;
  }
  return moves;
}

/**
 * Local DepFlow AI Coach — always available, no API key required.
 * Uses project graph, workload, and bottlenecks to guide distributed teams.
 */
export function buildAiInsights({ project, tasks, members, checkIns = [] }) {
  const bottlenecks = detectBottlenecks(tasks);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const progressTotal = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const percent = progressTotal ? Math.round((done / progressTotal) * 100) : 0;

  const workloads = members.map((m) => {
    const load = workloadFor(m.userId, tasks);
    return {
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      timezone: m.user.timezone || 'UTC',
      locationLabel: m.user.locationLabel || '',
      lastSeenAt: m.user.lastSeenAt,
      ...load,
    };
  });

  const readyNext = openTasks(tasks)
    .filter((t) => isUnblocked(t, byId) && t.status !== 'blocked')
    .sort((a, b) => (PRIORITY_WEIGHT[b.priority] || 1) - (PRIORITY_WEIGHT[a.priority] || 1))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      assignee: t.assignee
        ? { id: t.assignee.id, name: t.assignee.name }
        : null,
      why: !t.assigneeId
        ? 'Ready to start — needs an owner'
        : t.status === 'todo'
          ? 'Dependencies clear — good next pick'
          : 'Already in motion — keep it unblocked',
    }));

  const rebalance = suggestRebalance(
    workloads.map((w) => ({ ...w })),
    tasks
  );
  const suggestedTodos = buildSuggestedTodos(project, tasks, members, bottlenecks);

  const guidance = [];
  guidance.push(
    percent < 30
      ? `Launch is early (${percent}% done). Focus the team on unblocking the critical path before adding scope.`
      : percent < 70
        ? `Solid mid-flight progress at ${percent}%. Protect momentum on in-progress work and clear bottlenecks.`
        : `You're in the finish zone (${percent}%). Prioritize QA, polish, and launch checklist items.`
  );

  const overloaded = workloads.filter((w) => w.overloaded);
  if (overloaded.length) {
    guidance.push(
      `Overload alert: ${overloaded.map((w) => w.name).join(', ')} — redistribute todo work so remote teammates stay unblocked.`
    );
  } else {
    guidance.push('Workload looks balanced across the team right now.');
  }

  if (bottlenecks[0]) {
    guidance.push(`Top bottleneck: “${bottlenecks[0].title}”. Swarm this before starting new parallel work.`);
  }

  if (readyNext[0]) {
    guidance.push(`Recommended next move: “${readyNext[0].title}” (${readyNext[0].why}).`);
  }

  const recentCheckIns = checkIns.slice(0, 8).map((c) => ({
    id: c.id,
    user: { id: c.user.id, name: c.user.name, timezone: c.user.timezone },
    yesterday: c.yesterday,
    today: c.today,
    blockers: c.blockers,
    createdAt: c.createdAt,
  }));

  const standupSummary =
    recentCheckIns.length === 0
      ? 'No async check-ins yet. Ask each timezone to post a quick standup so the AI can summarize worldwide progress.'
      : `Latest check-ins from ${[...new Set(recentCheckIns.map((c) => c.user.name))].join(', ')}. Review blockers in Chat or start a team call.`;

  const timezones = [...new Set(workloads.map((w) => w.timezone).filter(Boolean))];

  return {
    coachName: 'DepFlow Guide',
    generatedAt: new Date().toISOString(),
    headline: `Guiding ${members.length} teammate${members.length === 1 ? '' : 's'} across ${timezones.length || 1} timezone${(timezones.length || 1) === 1 ? '' : 's'}`,
    guidance,
    progress: { percent, done, total: progressTotal },
    workloads,
    overloaded: overloaded.map((w) => ({
      userId: w.userId,
      name: w.name,
      score: w.score,
      openCount: w.openCount,
      tip: `Move 1–2 todo tasks off ${w.name} or pair them with a lighter teammate.`,
    })),
    bottlenecks: bottlenecks.slice(0, 5),
    nextActions: readyNext,
    rebalance,
    suggestedTodos,
    standupSummary,
    recentCheckIns,
    timezones,
    callHint: 'Start a team call when a bottleneck needs a live decision across regions.',
  };
}
