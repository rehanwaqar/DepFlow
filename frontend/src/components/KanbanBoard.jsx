import { useState } from 'react';
import { Avatar } from './Avatar';

const COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];

function depLabel(task) {
  const waits = task.dependsOn?.length || 0;
  const blocks = task.dependedOnBy?.length || 0;
  if (!waits && !blocks) return null;
  const parts = [];
  if (waits) parts.push(`waits on ${waits}`);
  if (blocks) parts.push(`blocks ${blocks}`);
  return parts.join(' · ');
}

export default function KanbanBoard({ tasks, bottleneckIds, onReorder, onOpenTask }) {
  const [dragId, setDragId] = useState(null);

  function tasksFor(status) {
    return tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);
  }

  async function moveTask(taskId, toStatus, toIndex) {
    const moving = tasks.find((t) => t.id === taskId);
    if (!moving) return;

    const columns = {};
    for (const col of COLUMNS) {
      columns[col.id] = tasksFor(col.id).filter((t) => t.id !== taskId);
    }
    columns[toStatus].splice(toIndex, 0, { ...moving, status: toStatus });

    const updates = [];
    for (const col of COLUMNS) {
      columns[col.id].forEach((t, i) => {
        updates.push({ id: t.id, status: col.id, position: i });
      });
    }
    await onReorder(updates);
  }

  function onDropColumn(e, status) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/task-id') || dragId;
    if (!taskId) return;
    const list = tasksFor(status).filter((t) => t.id !== taskId);
    moveTask(taskId, status, list.length);
    setDragId(null);
  }

  function onDropCard(e, status, index) {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData('text/task-id') || dragId;
    if (!taskId) return;
    moveTask(taskId, status, index);
    setDragId(null);
  }

  return (
    <div className="kanban">
      {COLUMNS.map((col) => (
        <section
          key={col.id}
          className="kanban-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDropColumn(e, col.id)}
        >
          <header>
            <h3>
              <span className={`col-dot ${col.id}`} aria-hidden="true" />
              {col.label}
            </h3>
            <span>{tasksFor(col.id).length}</span>
          </header>
          <div className="kanban-cards">
            {tasksFor(col.id).map((task, index) => {
              const deps = depLabel(task);
              const isBn = bottleneckIds.has(task.id);
              return (
                <article
                  key={task.id}
                  className={`task-card ${isBn ? 'is-bottleneck' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDragId(task.id);
                    e.dataTransfer.setData('text/task-id', task.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropCard(e, col.id, index)}
                  onClick={() => onOpenTask(task)}
                >
                  <div className="task-card-top">
                    <strong>{task.title}</strong>
                  </div>
                  <div className="task-meta">
                    <span className={`prio prio-${task.priority}`}>{task.priority}</span>
                    {isBn ? <span className="bn-tag">Bottleneck</span> : null}
                    {deps ? <span className="deps-meta">{deps}</span> : null}
                  </div>
                  <div className="task-assignee">
                    {task.assignee ? (
                      <>
                        <Avatar user={task.assignee} size={22} />
                        <span>{task.assignee.name.split(' ')[0]}</span>
                      </>
                    ) : (
                      <span className="unassigned">Unassigned</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
