import { avatarColor, initials } from '../utils/people';

export function Avatar({ user, size = 28, title }) {
  if (!user) {
    return (
      <span
        className="avatar avatar-empty"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        title={title || 'Unassigned'}
      >
        ?
      </span>
    );
  }
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: avatarColor(user.id || user.email || user.name),
      }}
      title={title || `${user.name} (${user.email})`}
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, size = 28 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="avatar-stack" style={{ ['--avatar-size']: `${size}px` }}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {extra > 0 && (
        <span className="avatar avatar-more" style={{ width: size, height: size, fontSize: size * 0.34 }}>
          +{extra}
        </span>
      )}
    </div>
  );
}
