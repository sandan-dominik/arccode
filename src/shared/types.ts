export interface Project {
  id: string;
  name: string;
  path: string;
  sessions: Session[];
  isArchived?: boolean;
  collapsed?: boolean;
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

export interface SessionSplitGroup {
  id: string;
  name: string;
  sessionIds: string[];
  layout?: LayoutType;
}

export interface SessionGroup {
  id: string;
  name: string;
  color?: string;
  sessionIds: string[];
  collapsed?: boolean;
  splitGroups?: SessionSplitGroup[];
}

export type ThemeMode = 'dark' | 'day-dark' | 'light';

export type ClaudeMode = 'claude' | 'claude-yolo' | 'codex' | 'codex-yolo' | 'codex-full-yolo';
export type OpenDefault = 'cursor' | 'explorer';

export interface StoreData {
  projects: Project[];
  activeSessionId: string | null;
  focusedProjectId?: string | null;
  sidebarWidth?: number;
  theme?: ThemeMode;
  terminalBgColor?: string;
  openedSessionIds?: string[];
  shellPath?: string;
  shellArgs?: string[];
  claudeDefault?: ClaudeMode;
  openDefault?: OpenDefault;
  autoCopy?: boolean;
  rightClickPaste?: boolean;
  servingCommands?: string[];
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
    getPlatform: () => string;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    unmaximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void;
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
