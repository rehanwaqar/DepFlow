import { useState } from 'react';
import { api } from '../api';
import { Avatar } from './Avatar';
import { formatRelative } from '../utils/people';

export default function TeamPanel({
  projectId,
  members,
  activities,
  myRole,
  onChanged,
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = myRole === 'owner';

  async function invite(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setEmail('');
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId) {
    if (!confirm('Remove this teammate from the project?')) return;
    await api(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
    await onChanged();
  }

  return (
    <aside className="team-panel">
      <section className="side-block">
        <div className="side-block-head">
          <h3>Team</h3>
          <span>{members.length}</span>
        </div>
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.id}>
              <Avatar user={m.user} size={32} />
              <div className="member-meta">
                <strong>{m.user.name}</strong>
                <span>
                  {m.role === 'owner' ? 'Owner' : 'Member'}
                  {m.user.locationLabel ? ` · ${m.user.locationLabel}` : ''}
                  {m.user.timezone ? ` · ${m.user.timezone}` : ''}
                </span>
              </div>
              {isOwner && m.role !== 'owner' && (
                <button
                  type="button"
                  className="btn danger-ghost visible"
                  onClick={() => removeMember(m.userId)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {isOwner ? (
          <form className="invite-form" onSubmit={invite}>
            <label>
              Invite by email
              <input
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {error && <div className="alert">{error}</div>}
            <button className="btn primary block" disabled={busy}>
              {busy ? 'Inviting…' : 'Add teammate'}
            </button>
            <p className="hint-soft">They need a DepFlow account first. Any team size works.</p>
          </form>
        ) : (
          <p className="hint-soft">Ask the owner to invite more people by email.</p>
        )}
      </section>

      <section className="side-block">
        <div className="side-block-head">
          <h3>Shared activity</h3>
        </div>
        {activities?.length ? (
          <ul className="activity-list">
            {activities.map((a) => (
              <li key={a.id}>
                <Avatar user={a.user} size={28} />
                <div>
                  <p>
                    <strong>{a.user.name}</strong> {a.message}
                  </p>
                  <time>{formatRelative(a.createdAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint-soft">Team updates will show up here.</p>
        )}
      </section>
    </aside>
  );
}
