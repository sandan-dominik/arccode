# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArcCode is a Windows Electron app for managing multiple Git Bash terminal sessions organized by project. Built with Electron + Vite + React + TypeScript, using xterm.js for terminal rendering and node-pty for pseudo-terminal spawning.

## Commands

- `npm start` — Run in dev mode (Electron Forge + Vite HMR)
- `npm run lint` — ESLint on TypeScript files
- `npm run package` — Package the app (no installer)
- `npm run make` — Build platform-specific installers
- `npm run rebuild` — Rebuild native modules (node-pty) for Electron

No test framework is configured.

## Releasing

Every release **must** include the Squirrel.Windows update artifacts so the in-app auto-updater works. Steps:

1. Bump `version` in `package.json`
2. Commit and push
3. `npm run make` — produces artifacts in `out/make/squirrel.windows/x64/`
4. Create the GitHub release: `gh release create vX.Y.Z --title "vX.Y.Z" --notes "..."`
5. Upload **all three** Squirrel artifacts:
   ```
   gh release upload vX.Y.Z \
     "out/make/squirrel.windows/x64/ArcCode-X.Y.Z Setup.exe" \
     "out/make/squirrel.windows/x64/arccode-X.Y.Z-full.nupkg" \
     "out/make/squirrel.windows/x64/RELEASES"
   ```
   The `RELEASES` file and `.nupkg` are required for Squirrel delta updates. Without them, existing installs cannot auto-update.

## Architecture

### Process Model (Electron)

```
Main Process (src/main/)          Preload (src/preload/)       Renderer (src/renderer/)
├── main.ts     — IPC handlers,   └── preload.ts — context     ├── App.tsx — root layout
│                 window setup         bridge exposing          ├── hooks/
├── pty-manager.ts — node-pty          ElectronAPI              │   ├── useStore.ts — state + persistence
│                    lifecycle                                   │   └── useTerminal.ts — xterm.js lifecycle
├── git-bash.ts — shell detection                               └── components/ — UI components
└── store.ts    — JSON persistence
```

### IPC Bridge

All renderer↔main communication goes through `window.electronAPI` defined in `src/preload/preload.ts`. The type contract lives in `src/shared/types.ts` (`ElectronAPI` interface). When adding new IPC:

1. Add the type to `src/shared/types.ts`
2. Add the `ipcMain.handle`/`ipcMain.on` in `src/main/main.ts`
3. Expose via `contextBridge` in `src/preload/preload.ts`

### State Management

`useStore` hook (`src/renderer/hooks/useStore.ts`) is a custom React hook (not Redux/Zustand). State is persisted to `%APPDATA%/terminal-manager-data.json` as JSON. The `StoreData` type in `src/shared/types.ts` defines the schema (projects, sessions, theme, shell config, etc.).

### Terminal Lifecycle

`useTerminal` hook creates an xterm.js instance, loads FitAddon + WebglAddon (with silent fallback), spawns a PTY via IPC, and wires bidirectional data flow. ResizeObserver handles container resize → PTY resize. Each pane gets its own PTY.

### node-pty Native Module Handling

node-pty requires special build/packaging treatment:
- `scripts/patch-node-pty.js` patches Windows build issues (Spectre mitigation, GenVersion)
- In packaged builds, node-pty is unpacked from ASAR (`forge.config.ts` unpack config)
- `pty-manager.ts` loads from `app.asar.unpacked/node_modules/node-pty` when packaged

### Layout System

Sessions support 5 layout types: `single`, `hsplit`, `vsplit`, `three` (1+2 split), `grid` (2×2). `TerminalArea.tsx` renders the layout using allotment panes, each containing a `TerminalPane.tsx`.

### Activity Detection

Terminals track state (idle → busy → completed → serving). Dev server URLs are detected via regex on PTY output. A completion chime plays for commands taking 5+ seconds (with 3-second suppression on tab switch to avoid false positives).
