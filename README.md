# ArcCode

Multi-terminal manager for Windows that organizes terminals by project and session.

## Features

- **Project-based organization** — Group terminal sessions under project folders
- **Activity tracking** — Visual indicators for session state (idle, completed, busy, serving)
- **Dev server detection** — Automatically detects `localhost` URLs from terminal output and offers "Open in Browser"
- **Script runner** — Run package.json scripts directly from the toolbar with auto-detected package manager
- **Claude Code integration** — Launch Claude directly from the toolbar
- **Right-click copy/paste** — Context menu in terminals for clipboard operations
- **Themes** — Dark and light mode

## Session States

| State | Indicator | Meaning |
|-------|-----------|---------|
| Idle | Gray dot | No recent activity |
| Busy | Blue pulsing dot | Command running |
| Completed | Green dot | Command finished (decays to idle after 10 min) |
| Serving | Purple dot | Dev server running (with clickable URL) |

## Install

Download the latest **ArcCode Setup.exe** from [Releases](https://github.com/sandan-dominik/arccode/releases).

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build installer
npx electron-forge make
```

## Tech Stack

- Electron + Vite
- React
- xterm.js
- node-pty

## License

MIT
