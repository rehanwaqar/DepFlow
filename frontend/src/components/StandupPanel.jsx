import { useEffect, useState } from 'react';
import { api } from '../api';
import { Avatar } from './Avatar';
import { formatRelative } from '../utils/people';

export default function StandupPanel({ projectId }) {
  const [checkIns, setCheckIns] = useState([]);
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api(`/projects/${projectId}/standups`);
    setCheckIns(data.checkIns);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [projectId]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${projectId}/standups`, {
        method: 'POST',
        body: JSON.stringify({ yesterday, today, blockers }),
      });
      setYesterday('');
      setToday('');
      setBlockers('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="standup-wrap">
      <header className="chat-head">
        <div>
          <h2>Async standup</h2>
          <p>Perfect for worldwide teams — post when you start your day, no meeting required.</p>
        </div>
      </header>

      <form className="standup-form stack-form" onSubmit={submit}>
        {error && <div className="alert">{error}</div>}
        <label>
          Yesterday
          <input value={yesterday} onChange={(e) => setYesterday(e.target.value)} placeholder="What shipped?" />
        </label>
        <label>
          Today
          <input value={today} onChange={(e) => setToday(e.target.value)} placeholder="What will you do next?" required />
        </label>
        <label>
          Blockers
          <input value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Anything stuck?" />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Posting…' : 'Post check-in'}
        </button>
      </form>

      <ul className="checkin-list">
        {checkIns.map((c) => (
          <li key={c.id}>
            <Avatar user={c.user} size={30} />
            <div>
              <strong>
                {c.user.name}
                <em>
                  {' '}
                  · {c.user.locationLabel || c.user.timezone} · {formatRelative(c.createdAt)}
                </em>
              </strong>
              {c.yesterday ? (
                <p>
                  <b>Yesterday:</b> {c.yesterday}
                </p>
              ) : null}
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
    </div>
  );
}
