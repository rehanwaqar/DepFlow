import { useEffect, useState } from 'react';
import { api } from '../api';
import { Avatar } from './Avatar';

function WorkloadBar({ score, overloaded }) {
  const pct = Math.min(100, Math.round((score / 12) * 100));
  return (
    <div className={`load-bar ${overloaded ? 'over' : ''}`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AiCoach({ projectId, onApplied }) {
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/projects/${projectId}/ai/insights`);
      setInsights(data.insights);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function applyTodos() {
    setBusy('todos');
    try {
      const data = await api(`/projects/${projectId}/ai/apply-todos`, { method: 'POST', body: '{}' });
      await load();
      await onApplied?.();
      alert(data.count ? `Added ${data.count} AI todo${data.count === 1 ? '' : 's'}.` : 'Suggested todos already exist.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function applyRebalance() {
    setBusy('rebalance');
    try {
      const data = await api(`/projects/${projectId}/ai/apply-rebalance`, {
        method: 'POST',
        body: '{}',
      });
      await load();
      await onApplied?.();
      alert(data.count ? `Reassigned ${data.count} task${data.count === 1 ? '' : 's'}.` : 'No rebalance needed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  if (loading) return <div className="coach-wrap muted">DepFlow Guide is reading the board…</div>;
  if (error && !insights) return <div className="alert">{error}</div>;
  if (!insights) return null;

  return (
    <div className="coach-wrap">
      <header className="coach-hero">
        <div>
          <p className="eyebrow">AI team guide</p>
          <h2>{insights.coachName}</h2>
          <p>{insights.headline}</p>
        </div>
        <div className="coach-actions">
          <button className="btn ghost" type="button" onClick={load}>
            Refresh
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={busy === 'todos'}
            onClick={applyTodos}
          >
            {busy === 'todos' ? 'Adding…' : 'Add AI todos'}
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={busy === 'rebalance' || !insights.rebalance?.length}
            onClick={applyRebalance}
          >
            {busy === 'rebalance' ? 'Splitting…' : 'Apply work split'}
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      <section className="coach-guidance">
        <h3>What to do next</h3>
        <ul>
          {insights.guidance.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </section>

      <div className="coach-grid">
        <section className="coach-card">
          <h3>Workload & overload</h3>
          <ul className="workload-list">
            {insights.workloads.map((w) => (
              <li key={w.userId} className={w.overloaded ? 'is-over' : ''}>
                <div className="workload-top">
                  <Avatar
                    user={{ id: w.userId, name: w.name, email: w.email }}
                    size={30}
                  />
                  <div>
                    <strong>
                      {w.name}
                      {w.overloaded ? ' · Overloaded' : ''}
                    </strong>
                    <span>
                      {w.locationLabel || w.timezone} · {w.openCount} open · score {w.score}
                    </span>
                  </div>
                </div>
                <WorkloadBar score={w.score} overloaded={w.overloaded} />
              </li>
            ))}
          </ul>
        </section>

        <section className="coach-card">
          <h3>Ready next actions</h3>
          {insights.nextActions.length === 0 ? (
            <p className="hint-soft">No clear next actions yet.</p>
          ) : (
            <ul className="next-list">
              {insights.nextActions.map((a) => (
                <li key={a.id}>
                  <strong>{a.title}</strong>
                  <span>{a.why}</span>
                  <em>{a.assignee?.name || 'Unassigned'} · {a.priority}</em>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="coach-card">
          <h3>Suggested work split</h3>
          {insights.rebalance.length === 0 ? (
            <p className="hint-soft">Assignments look healthy.</p>
          ) : (
            <ul className="next-list">
              {insights.rebalance.map((m) => (
                <li key={`${m.taskId}-${m.toUserId}`}>
                  <strong>{m.title}</strong>
                  <span>
                    {m.fromName} → {m.toName}
                  </span>
                  <em>{m.reason}</em>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="coach-card">
          <h3>AI todo ideas</h3>
          {insights.suggestedTodos.length === 0 ? (
            <p className="hint-soft">No extra todos suggested.</p>
          ) : (
            <ul className="next-list">
              {insights.suggestedTodos.map((t) => (
                <li key={t.title}>
                  <strong>{t.title}</strong>
                  <span>{t.reason}</span>
                  <em>{t.priority} priority</em>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="coach-card standup-card">
        <h3>Worldwide standup pulse</h3>
        <p className="hint-soft">{insights.standupSummary}</p>
        {insights.recentCheckIns?.length > 0 && (
          <ul className="checkin-list">
            {insights.recentCheckIns.map((c) => (
              <li key={c.id}>
                <Avatar user={c.user} size={28} />
                <div>
                  <strong>
                    {c.user.name}
                    <em> · {c.user.timezone || 'UTC'}</em>
                  </strong>
                  <p>
                    <b>Today:</b> {c.today}
                  </p>
                  {c.blockers ? (
                    <p className="blockers">
                      <b>Blockers:</b> {c.blockers}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
