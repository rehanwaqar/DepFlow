import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@depflow.app');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
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
        <h1>Work together on what actually blocks progress</h1>
        <p className="lede">
          Shared boards for teams of any size—invite people, assign work, and watch progress update live.
        </p>
        <form onSubmit={onSubmit} className="stack-form">
          {error && <div className="alert">{error}</div>}
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
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="auth-footer">
          <p className="muted">
            No account? <Link to="/register">Create one</Link>
          </p>
          <p className="demo-hint">
            Demo team (password <code>demo1234</code>):
            <br />
            <code>demo@depflow.app</code> (SF) · <code>jordan@depflow.app</code> (London) ·{' '}
            <code>sam@depflow.app</code> (Lagos)
          </p>
        </div>
      </div>
      <div className="auth-visual" aria-hidden="true">
        <div className="flow-orb" />
        <div className="flow-lines" />
        <div className="auth-visual-inner">
          <div className="auth-visual-copy">
            <strong>One board for the whole team</strong>
            <span>Everyone sees the same tasks, owners, blockers, and completion progress.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
