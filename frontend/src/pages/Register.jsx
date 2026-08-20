import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [timezone, setTimezone] = useState(TZ);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(name, email, password, { timezone, locationLabel });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <p className="brand">DepFlow</p>
        <h1>Join from anywhere</h1>
        <p className="lede">
          Create an account with your timezone so global teammates know when you’re online.
        </p>
        <form onSubmit={onSubmit} className="stack-form">
          {error && <div className="alert">{error}</div>}
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <label>
            Location (optional)
            <input
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="e.g. Berlin, DE"
            />
          </label>
          <label>
            Timezone
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
          </label>
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <div className="auth-footer">
          <p className="muted">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
      <div className="auth-visual" aria-hidden="true">
        <div className="flow-orb" />
        <div className="flow-lines" />
        <div className="auth-visual-inner">
          <div className="auth-visual-copy">
            <strong>Remote-first by design</strong>
            <span>Chat, calls, async standups, and an AI guide that keeps every region aligned.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
