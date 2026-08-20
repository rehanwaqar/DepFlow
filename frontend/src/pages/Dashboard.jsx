import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { AvatarStack } from '../components/Avatar';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/projects');
      setProjects(data.projects);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeProject(id) {
    if (!confirm('Delete this project for the whole team?')) return;
    await api(`/projects/${id}`, { method: 'DELETE' });
    setProjects((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand-link">
          DepFlow
        </Link>
        <div className="topbar-right">
          <span className="user-chip">{user?.name}</span>
          <button className="btn ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="page">
        <section className="hero-band">
          <div>
            <p className="eyebrow">Team workspace</p>
            <h1>Projects you share</h1>
            <p>
              Invite anyone by email, assign work, and keep one live view of progress—whether you’re
              two people or twenty.
            </p>
          </div>
        </section>

        <section className="create-panel">
          <h2>Start a shared project</h2>
          <form className="create-bar" onSubmit={createProject}>
            <input
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              placeholder="What is the team shipping?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button className="btn primary" type="submit">
              Create
            </button>
          </form>
        </section>

        {error && <div className="alert">{error}</div>}

        {loading ? (
          <p className="muted">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <strong>No shared projects yet</strong>
            <span>Create one, then invite teammates by email from the project page.</span>
          </div>
        ) : (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="project-row">
                  <div className="project-main">
                    <div className="project-title-row">
                      <strong>{p.name}</strong>
                      <span className={`role-pill ${p.role}`}>{p.role}</span>
                    </div>
                    <span>{p.description || 'No description'}</span>
                    <div className="project-foot">
                      <div className="mini-progress">
                        <div style={{ width: `${p.progress?.percent || 0}%` }} />
                      </div>
                      <em>{p.progress?.percent ?? 0}% done</em>
                      <em>{p._count?.members ?? 1} people</em>
                      <em>{p._count?.tasks ?? 0} tasks</em>
                    </div>
                  </div>
                  <AvatarStack
                    users={[p.owner].filter(Boolean)}
                    max={1}
                    size={34}
                  />
                </Link>
                {p.role === 'owner' && (
                  <button
                    className="btn danger-ghost"
                    type="button"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => removeProject(p.id)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
