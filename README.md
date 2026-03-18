# ArcCode

ArcCode is a Windows desktop terminal workspace for people who work across multiple codebases, multiple shells, and multiple long-running dev processes at the same time.

Instead of scattering Git Bash windows across your desktop, ArcCode keeps projects, sessions, groups, split layouts, scripts, and dev server links in one place.

## Why ArcCode Exists

Most terminal workflows break down the same way:

- one repo becomes three shells
- three shells become five tools
- one active task becomes a pile of terminals you are afraid to close
- when you switch context, you lose track of what each window was for

ArcCode fixes that by treating the terminal as part of the project, not as a disposable window.

That gives you:

- project-based organization instead of loose terminal windows
- named sessions you can come back to later
- activity-aware terminals so you can tell what is running
- grouped workflows for services that belong together
- fast project switching when you want to stay in focus mode

## What ArcCode Does

ArcCode combines a terminal manager, lightweight workspace organizer, and developer control surface.

Core capabilities:

- add local folders as projects
- create multiple terminal sessions per project
- rename, archive, remove, and focus projects
- group sessions into work sets
- build split groups for side-by-side terminal workflows
- drag and reorder sessions at the root level and inside groups
- move sessions between groups and back out to the root list
- track terminal activity states in real time
- detect local dev server URLs from terminal output
- open projects in Cursor or Explorer
- launch common AI tools directly from the app
- run package scripts and commands from a command palette

## Feature Overview

### Projects

Projects are the top-level unit in ArcCode.

Each project represents a local folder and can contain multiple sessions. This is useful when one codebase needs separate terminals for app runtime, tests, package scripts, background workers, migrations, or AI tools.

Project features:

- add a folder as a project
- create one or many sessions under that project
- rename sessions to reflect purpose
- archive projects you are not actively using
- remove projects completely when they are no longer needed
- use focus mode to work inside a smaller project set

Why this matters:

- you stop losing track of which terminal belongs to which repo
- reopening work is faster because the project structure is already there
- inactive work can be archived instead of deleted

### Sessions

A session is a named terminal attached to a project.

Sessions are useful when a single repository needs multiple concurrent tasks, for example:

- `frontend`
- `api`
- `db`
- `tests`
- `worker`
- `claude`
- `codex`

Session features:

- rename sessions to match the task they handle
- reorder sessions by drag and drop
- view activity state at a glance
- right-click for management and grouping actions

Why this matters:

- sessions become intentional working contexts instead of anonymous shells
- you can leave complex projects set up the way you actually use them

### Groups

Groups let you collect related sessions into a shared workflow.

Example:

- a `Convex` group might hold API, functions, and migration terminals
- an `App` group might hold frontend and web tooling terminals
- a `Stripe` group might hold webhook and local integration terminals

Group features:

- create groups from selected sessions
- rename groups
- collapse and expand groups
- color groups for quick visual scanning
- add a new terminal directly into a group from the header
- drag to reorder sessions inside a group
- drag sessions from one group into another group
- drag sessions back out of a group to the root list

Why this matters:

- related terminals stay together
- large projects become easier to scan
- you can reshape workflows without rebuilding them from scratch

### Split Groups

Split groups are explicit multi-terminal layouts inside a group.

You can take a few sessions from the same group and turn them into a split workflow for side-by-side work. This is useful when you need a stable multi-pane setup for tasks like:

- frontend + backend
- worker + logs
- app + tests
- local server + AI assistant

Split group features:

- create split groups from selected sessions in the same group
- preserve layout choices for the split
- reopen the split later from the sidebar
- remove split groups without removing the underlying sessions

Why this matters:

- multi-terminal work becomes reusable instead of temporary
- the workspace matches how full-stack tasks are actually done

### Activity Tracking

ArcCode watches terminal behavior and surfaces useful session states:

- idle
- busy
- completed
- serving
- error

Why this matters:

- you can see which terminals are still doing work
- long-running servers stand out from one-off commands
- completed tasks are easier to identify when you return to a project later

### Dev Server Detection

ArcCode detects local serving URLs from terminal output and surfaces them in the UI.

This is especially useful for development servers started with commands like:

- `npm run dev`
- `npm start`
- other configured serving commands

Why this matters:

- you do not have to copy local URLs manually from terminal output
- active server sessions become immediately useful, not just visible

### Command Palette

ArcCode includes a command palette for fast actions across the current workspace.

Shortcut:

- `Ctrl+K`

The command palette works even when the terminal is focused.

Command palette actions include:

- running package scripts
- launching AI commands
- opening the current project in external tools

Why this matters:

- common actions are centralized
- you can trigger project actions without leaving keyboard flow

### Project Switcher

When focus mode is active, ArcCode provides a project switcher so you can move between focused projects quickly.

Shortcut:

- `Ctrl+Tab`

Why this matters:

- switching between active projects becomes fast and predictable
- you can stay in a reduced workspace without losing navigation speed

### AI and Tool Launchers

ArcCode can launch common tools directly into your terminal workflow.

Current built-in actions include:

- Claude
- Codex
- Cursor
- Explorer

Why this matters:

- AI tools become part of the same workspace as your project terminals
- opening external tools stays tied to the active project context

### Settings

ArcCode includes settings for terminal and workflow behavior, including:

- theme
- terminal background color
- shell path and shell arguments
- default AI launcher behavior
- default open behavior
- auto-copy behavior
- right-click paste behavior
- serving command detection rules

Why this matters:

- the app adapts to your shell and workflow instead of forcing defaults

## Keyboard Shortcuts

- `Ctrl+K`: Open the command palette
- `Ctrl+Tab`: Cycle through focused projects in the project switcher
- `Ctrl+Shift+Tab`: Cycle backward through focused projects
- `Ctrl+G`: Group selected sessions
- `Ctrl+S`: Create a split group from selected sessions in the same group
- `Ctrl+Click` on a session: Multi-select sessions

## Installation

Download the latest Windows release assets from GitHub Releases.

Recommended asset for normal installs:

- `ArcCode-<version>.Setup.exe`

Assets required if you want auto-updates to continue working for installed users:

- `ArcCode-<version>.Setup.exe`
- `arccode-<version>-full.nupkg`
- `RELEASES`

## Development

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm start
```

Build distributable artifacts:

```bash
npm run make
```

Windows release artifacts are generated under:

```text
out/make/squirrel.windows/x64/
```

## Release 0.1.10

This release includes the recent workflow improvements across session management and navigation, including:

- `Ctrl+K` command palette access that still works while a terminal is focused
- cleaner group headers
- direct add-terminal action from the group header
- drag and drop reordering for sessions inside groups
- moving sessions across groups and back to the root list
- project switcher layout capped to 4 items per row

## Tech Stack

- Electron
- React
- Vite
- xterm.js
- node-pty
- Electron Forge

## License

MIT
