import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import KanbanBoard from '../components/KanbanBoard';
import DependencyFlow from '../components/DependencyFlow';
import TaskModal from '../components/TaskModal';
import TeamPanel from '../components/TeamPanel';
import ProgressBar from '../components/ProgressBar';
import AiCoach from '../components/AiCoach';
import TeamChat from '../components/TeamChat';
import StandupPanel from '../components/StandupPanel';
import { AvatarStack } from '../components/Avatar';

const VIEWS = [
  { id: 'kanban', label: 'Board' },
  { id: 'flow', label: 'Flow' },
  { id: 'coach', label: 'AI Guide' },
  { id: 'chat', label: 'Chat' },
  { id: 'standup', label: 'Standup' },
];

export default function ProjectBoard() {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const [project, setProject] = useState(null);
  const [bottlenecks, setBottlenecks] = useState([]);
  const [progress, setProgress] = useState(null);
  const [myRole, setMyRole] = useState('member');
  const [view, setView] = useState('kanban');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalTask, setModalTask] = useState(null);
  const [creating, setCreating] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [callBusy, setCallBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/projects/${id}`);
      setProject(data.project);
      setBottlenecks(data.bottlenecks || []);
      setProgress(data.progress);
      setMyRole(data.myRole);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const bottleneckIds = useMemo(
    () => new Set(bottlenecks.map((b) => b.taskId)),
    [bottlenecks]
  );

  const topBottlenecks = bottlenecks.slice(0, 3);
  const memberUsers = useMemo(
    () => (project?.members || []).map((m) => m.user),
    [project]
  );

  async function onReorder(updates) {
    await api(`/projects/${id}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
    await load();
  }

  async function saveTask(payload) {
    if (creating) {
      await api(`/projects/${id}/tasks`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } else if (modalTask) {
      await api(`/tasks/${modalTask.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (payload.dependencyIds) {
        const current = new Set((modalTask.dependsOn || []).map((d) => d.dependencyId));
        const next = new Set(payload.dependencyIds);
        for (const depId of next) {
          if (!current.has(depId)) {
            await api(`/tasks/${modalTask.id}/dependencies`, {
              method: 'POST',
              body: JSON.stringify({ dependencyId: depId }),
            });
          }
        }
        for (const depId of current) {
          if (!next.has(depId)) {
            await api(`/tasks/${modalTask.id}/dependencies/${depId}`, { method: 'DELETE' });
          }
        }
      }
    }
    setModalTask(null);
    setCreating(false);
    await load();
  }

  async function deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    await api(`/tasks/${taskId}`, { method: 'DELETE' });
    setModalTask(null);
    await load();
  }

  function openTask(task) {
    setCreating(false);
    setModalTask(task);
  }

  async function startCall() {
    setCallBusy(true);
    try {
      const data = await api(`/projects/${id}/ai/call`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message);
    } finally {
      setCallBusy(false);
    }
  }

  if (loading) return <div className="boot">Loading shared project…</div>;
  if (error && !project) {
    return (
      <div className="boot">
        <p className="alert">{error}</p>
        <Link to="/">Back to projects</Link>
      </div>
    );
  }

  const showBoardChrome = view === 'kanban' || view === 'flow';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand-link">
            DepFlow
          </Link>
          <span className="crumb">/</span>
          <span className="crumb-name">{project.name}</span>
        </div>
        <div className="topbar-right">
          <AvatarStack users={memberUsers} max={4} size={30} />
          <span className="user-chip">{user?.name}</span>
          <button className="btn ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="page board-page">
        <div className="board-toolbar">
          <div>
            <h1>{project.name}</h1>
            <p>{project.description || 'Everyone on the team sees the same board and progress.'}</p>
          </div>
          <div className="toolbar-actions">
            <button className="btn call" type="button" disabled={callBusy} onClick={startCall}>
              {callBusy ? 'Opening…' : 'Start call'}
            </button>
            <button
              type="button"
              className={`btn ghost ${sideOpen ? 'active-toggle' : ''}`}
              onClick={() => setSideOpen((v) => !v)}
            >
              {sideOpen ? 'Hide team' : 'Team'}
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                setCreating(true);
                setModalTask(null);
              }}
            >
              Add task
            </button>
          </div>
        </div>

        <div className="seg seg-wide" role="tablist" aria-label="Workspace view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={view === v.id ? 'active' : ''}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <ProgressBar progress={progress} />

        {showBoardChrome && topBottlenecks.length > 0 && (
          <div className="bn-strip" role="status">
            <span className="bn-strip-label">Needs attention</span>
            <div className="bn-chips">
              {topBottlenecks.map((b) => (
                <button
                  key={b.taskId}
                  type="button"
                  className="bn-chip"
                  title={b.reasons.join(' · ')}
                  onClick={() => {
                    const t = project.tasks.find((x) => x.id === b.taskId);
                    if (t) openTask(t);
                  }}
                >
                  {b.title}
                </button>
              ))}
              {bottlenecks.length > 3 && (
                <span className="bn-more">+{bottlenecks.length - 3} more</span>
              )}
            </div>
          </div>
        )}

        <div className={`board-layout ${sideOpen ? 'with-side' : ''}`}>
          <div className="board-main">
            {view === 'kanban' && (
              <KanbanBoard
                tasks={project.tasks}
                bottleneckIds={bottleneckIds}
                onReorder={onReorder}
                onOpenTask={openTask}
              />
            )}
            {view === 'flow' && (
              <DependencyFlow
                projectId={id}
                onOpenTask={(taskId) => {
                  const t = project.tasks.find((x) => x.id === taskId);
                  if (t) openTask(t);
                }}
              />
            )}
            {view === 'coach' && <AiCoach projectId={id} onApplied={load} />}
            {view === 'chat' && <TeamChat projectId={id} />}
            {view === 'standup' && <StandupPanel projectId={id} />}
          </div>
          {sideOpen && (
            <TeamPanel
              projectId={id}
              members={project.members || []}
              activities={project.activities || []}
              myRole={myRole}
              onChanged={load}
            />
          )}
        </div>
      </main>

      {(creating || modalTask) && (
        <TaskModal
          task={creating ? null : modalTask}
          allTasks={project.tasks}
          members={project.members || []}
          onClose={() => {
            setCreating(false);
            setModalTask(null);
          }}
          onSave={saveTask}
          onDelete={modalTask ? () => deleteTask(modalTask.id) : null}
        />
      )}
    </div>
  );
}
