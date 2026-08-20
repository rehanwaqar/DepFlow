export default function ProgressBar({ progress }) {
  if (!progress) return null;
  const { percent, total, done, byStatus } = progress;
  return (
    <div className="progress-card">
      <div className="progress-top">
        <div>
          <strong>Team progress</strong>
          <span>
            {done} of {total} tasks done
          </span>
        </div>
        <em>{percent}%</em>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-stats">
        <span>
          <i className="dot todo" /> To do {byStatus.todo}
        </span>
        <span>
          <i className="dot in_progress" /> Active {byStatus.in_progress}
        </span>
        <span>
          <i className="dot blocked" /> Blocked {byStatus.blocked}
        </span>
        <span>
          <i className="dot done" /> Done {byStatus.done}
        </span>
      </div>
    </div>
  );
}
