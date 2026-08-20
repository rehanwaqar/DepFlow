import { useMemo, useState } from 'react';

const STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];

const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export default function TaskModal({ task, allTasks, members = [], onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || task?.assignee?.id || '');
  const [dependencyIds, setDependencyIds] = useState(
    () => (task?.dependsOn || []).map((d) => d.dependencyId)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const candidates = useMemo(
    () => allTasks.filter((t) => t.id !== task?.id),
    [allTasks, task]
  );

  function toggleDep(id) {
    setDependencyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({
        title,
        description,
        status,
        priority,
        dependencyIds,
        assigneeId: assigneeId || null,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header>
          <h2>{task ? 'Edit task' : 'New task'}</h2>
          <button className="icon-close" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form onSubmit={submit} className="stack-form">
          {error && <div className="alert">{error}</div>}
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes for the team"
            />
          </label>
          <div className="form-row">
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Assignee
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="dep-fieldset">
            <legend>Depends on</legend>
            <p className="dep-hint">This task waits until selected tasks are done.</p>
            {candidates.length === 0 ? (
              <p className="muted">No other tasks yet.</p>
            ) : (
              <ul className="dep-checklist">
                {candidates.map((t) => (
                  <li key={t.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={dependencyIds.includes(t.id)}
                        onChange={() => toggleDep(t.id)}
                      />
                      <span>
                        {t.title} <em>· {t.status.replace('_', ' ')}</em>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <div className="modal-actions">
            {onDelete && (
              <button type="button" className="btn danger" onClick={onDelete}>
                Delete
              </button>
            )}
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
