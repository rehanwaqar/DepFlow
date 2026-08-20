# DepFlow

Shared, dependency-aware project boards for distributed teams — with an AI guide, chat, calls, and async standups.

## Stack

- **Backend:** Node.js, Express, Prisma, SQLite, JWT auth
- **Frontend:** React, Vite, React Flow
- **Calls:** Jitsi Meet room per project (no account required)

## Quick start

```bash
npm install
npm run setup
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:4000

### Demo global team (password `demo1234`)

| Email | Person | Location |
| --- | --- | --- |
| `demo@depflow.app` | Alex (owner) | San Francisco |
| `jordan@depflow.app` | Jordan | London |
| `sam@depflow.app` | Sam | Lagos |

## Features

- Shared projects + invite by email (any team size)
- Task assignees, dependencies, bottlenecks, Kanban + flow view
- **AI Guide:** next actions, overload detection, work split, suggested todos
- **Team chat** for worldwide discussion
- **Start call** (Jitsi) for live decisions
- **Async standups** for timezone-friendly progress sharing
- Presence + location/timezone on profiles
