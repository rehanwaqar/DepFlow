/**
 * Detect bottleneck tasks:
 * - High outbound blocking score (many unfinished dependents waiting on this task)
 * - Blocked tasks with unmet dependencies
 * - Critical path nodes (high fan-in + fan-out while not done)
 */
export function detectBottlenecks(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const results = [];

  for (const task of tasks) {
    if (task.status === 'done') continue;

    const dependents = task.dependedOnBy || [];
    const dependencies = task.dependsOn || [];

    const unfinishedDependents = dependents.filter((d) => {
      const dep = byId.get(d.dependentId);
      return dep && dep.status !== 'done';
    });

    const unmetDeps = dependencies.filter((d) => {
      const dep = byId.get(d.dependencyId);
      return dep && dep.status !== 'done';
    });

    const fanOut = unfinishedDependents.length;
    const fanIn = unmetDeps.length;
    let score = fanOut * 3 + fanIn;
    const reasons = [];

    if (fanOut >= 2) {
      reasons.push(`Blocks ${fanOut} unfinished tasks`);
      score += 2;
    }
    if (task.status === 'blocked' || (fanIn > 0 && task.status !== 'done')) {
      if (fanIn > 0) reasons.push(`Waiting on ${fanIn} incomplete dependencies`);
    }
    if (task.status === 'blocked') {
      reasons.push('Marked as blocked');
      score += 2;
    }
    if (fanOut >= 1 && fanIn >= 1) {
      reasons.push('On a critical chain (fan-in and fan-out)');
      score += 3;
    }
    if (task.priority === 'high' && fanOut >= 1) {
      reasons.push('High priority with downstream work');
      score += 2;
    }

    if (score >= 3 && reasons.length > 0) {
      results.push({
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        score,
        reasons,
        blocksCount: fanOut,
        waitingOnCount: fanIn,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/** Returns true if adding edge dependencyId -> dependentId would create a cycle */
export function wouldCreateCycle(tasks, dependentId, dependencyId) {
  if (dependentId === dependencyId) return true;
  const adj = new Map();
  for (const t of tasks) {
    adj.set(t.id, (t.dependsOn || []).map((d) => d.dependencyId));
  }
  // After adding: dependent depends on dependency
  const current = adj.get(dependentId) || [];
  adj.set(dependentId, [...current, dependencyId]);

  const visited = new Set();
  const stack = [dependencyId];
  while (stack.length) {
    const node = stack.pop();
    if (node === dependentId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of adj.get(node) || []) stack.push(next);
  }
  return false;
}
