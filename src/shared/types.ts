export interface Project {
  id: string;
  name: string;
  path: string;
  sessions: Session[];
}

export interface Session {
  id: string;
  projectId: string;
  name: string;
  lastCommand: string;
  layout: LayoutType;
  createdAt: number;
}

export type LayoutType = 'single' | 'hsplit' | 'vsplit' | 'three' | 'grid';

export interface SessionGroup {
  id: string;
  name: string;
  color?: string;
  sessionIds: string[];
  layout?: LayoutType;
}

export type ThemeMode = 'dark' | 'day-dark' | 'light';

export type ClaudeMode = 'claude' | 'claude-yolo' | 'codex';
export type OpenDefault = 'cursor' | 'explorer';

export interface StoreData {
  projects: Project[];
  activeSessionId: string | null;
  theme?: ThemeMode;
  terminalBgColor?: string;
  openedSessionIds?: string[];
  shellPath?: string;
  shellArgs?: string[];
  claudeDefault?: ClaudeMode;
  openDefault?: OpenDefault;
  autoCopy?: boolean;
  rightClickPaste?: boolean;
  sessionGroups?: SessionGroup[];
}

export interface ElectronAPI {
  pty: {
    create: (cwd?: string, shellPath?: string, shellArgs?: string[]) => Promise<string>;
    write: (ptyId: string, data: string) => void;
    resize: (ptyId: string, cols: number, rows: number) => void;
    kill: (ptyId: string) => void;
    onData: (callback: (ptyId: string, data: string) => void) => () => void;
  };
  store: {
    load: () => Promise<StoreData>;
    save: (data: StoreData) => Promise<void>;
  };
  dialog: {
    openDirectory: () => Promise<string | null>;
    openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  };
  git: {
    getBranch: (cwd: string) => Promise<string>;
  };
  pkg: {
    getScripts: (cwd: string) => Promise<{ scripts: Record<string, string>; pm: string }>;
  };
  shell: {
    openInCursor: (cwd: string) => void;
    openInExplorer: (cwd: string) => void;
    openExternal: (url: string) => void;
  };
  app: {
    getVersion: () => string;
  };
  updater: {
    check: () => void;
    install: () => void;
    onStatus: (callback: (status: 'downloading' | 'ready' | 'up-to-date' | 'error') => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
