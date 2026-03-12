import { app } from 'electron';
import path from 'node:path';
import { findGitBash } from './git-bash';

// In production, node-pty lives in app.asar.unpacked/node_modules
// In dev, normal require resolution works
function loadNodePty() {
  if (app.isPackaged) {
    const unpackedPath = path.join(path.dirname(app.getAppPath()), 'app.asar.unpacked', 'node_modules', 'node-pty');
    return require(unpackedPath);
  }
  return require('node-pty');
}

const pty = loadNodePty();

import type { IPty } from 'node-pty';

const ptys = new Map<string, IPty>();
let nextId = 1;

export function createPty(
  onData: (id: string, data: string) => void,
  cwd?: string,
  shellPath?: string,
  shellArgs?: string[],
): string {
  const id = `pty-${nextId++}`;
  const shell = shellPath || findGitBash();
  const args = shellArgs || ['--login', '-i'];

  const proc = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: cwd || process.env['USERPROFILE'] || 'C:\\',
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
  });

  proc.onData((data) => onData(id, data));
  proc.onExit(() => {
    ptys.delete(id);
  });

  ptys.set(id, proc);
  return id;
}

export function writePty(id: string, data: string): void {
  ptys.get(id)?.write(data);
}

export function resizePty(id: string, cols: number, rows: number): void {
  ptys.get(id)?.resize(cols, rows);
}

export function killPty(id: string): void {
  const proc = ptys.get(id);
  if (proc) {
    proc.kill();
    ptys.delete(id);
  }
}

export function killAll(): void {
  for (const [id, proc] of ptys) {
    proc.kill();
    ptys.delete(id);
  }
}
