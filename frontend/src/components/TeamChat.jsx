import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Avatar } from './Avatar';
import { formatRelative } from '../utils/people';

export default function TeamChat({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const sinceRef = useRef(null);

  async function load(initial = false) {
    try {
      const q = !initial && sinceRef.current
        ? `?since=${encodeURIComponent(sinceRef.current)}`
        : '';
      const data = await api(`/projects/${projectId}/chat${q}`);
      if (initial) {
        setMessages(data.messages);
      } else if (data.messages.length) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...prev, ...data.messages.filter((m) => !ids.has(m.id))];
        });
      }
      if (data.messages.length) {
        sinceRef.current = data.messages[data.messages.length - 1].createdAt;
      } else if (initial && data.messages.length === 0) {
        sinceRef.current = new Date().toISOString();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    sinceRef.current = null;
    load(true);
    const poll = setInterval(() => load(false), 4000);
    return () => clearInterval(poll);
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const data = await api(`/projects/${projectId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setMessages((prev) => [...prev, data.message]);
      sinceRef.current = data.message.createdAt;
      setBody('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-wrap">
      <header className="chat-head">
        <div>
          <h2>Team chat</h2>
          <p>Discuss progress across timezones — messages sync for everyone on the project.</p>
        </div>
      </header>
      {error && <div className="alert">{error}</div>}
      <div className="chat-stream">
        {messages.length === 0 ? (
          <p className="empty-chat">No messages yet. Say hi to your distributed teammates.</p>
        ) : (
          messages.map((m) => (
            <article key={m.id} className="chat-bubble">
              <Avatar user={m.user} size={32} />
              <div>
                <header>
                  <strong>{m.user.name}</strong>
                  <span>
                    {m.user.locationLabel || m.user.timezone || 'Remote'} · {formatRelative(m.createdAt)}
                  </span>
                </header>
                <p>{m.body}</p>
              </div>
            </article>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <form className="chat-compose" onSubmit={send}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share an update, ask for help, or plan the next step…"
          maxLength={2000}
        />
        <button className="btn primary" disabled={busy || !body.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
