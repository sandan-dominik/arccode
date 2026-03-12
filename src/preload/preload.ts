import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';

const api: ElectronAPI = {
  pty: {
    create: (cwd?: string, shellPath?: string, shellArgs?: string[]) => ipcRenderer.invoke('pty:create', cwd, shellPath, shellArgs),
    write: (ptyId, data) => ipcRenderer.send('pty:write', ptyId, data),
    resize: (ptyId, cols, rows) => ipcRenderer.send('pty:resize', ptyId, cols, rows),
    kill: (ptyId) => ipcRenderer.send('pty:kill', ptyId),
    onData: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, ptyId: string, data: string) => {
        callback(ptyId, data);
      };
      ipcRenderer.on('pty:data', handler);
      return () => {
        ipcRenderer.removeListener('pty:data', handler);
      };
    },
  },
  store: {
    load: () => ipcRenderer.invoke('store:load'),
    save: (data) => ipcRenderer.invoke('store:save', data),
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openFile: (filters?) => ipcRenderer.invoke('dialog:openFile', filters),
  },
  git: {
    getBranch: (cwd: string) => ipcRenderer.invoke('git:getBranch', cwd),
  },
  pkg: {
    getScripts: (cwd: string) => ipcRenderer.invoke('pkg:getScripts', cwd),
  },
  shell: {
    openInCursor: (cwd: string) => ipcRenderer.send('shell:openInCursor', cwd),
    openInExplorer: (cwd: string) => ipcRenderer.send('shell:openInExplorer', cwd),
    openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
  },
  app: {
    getVersion: () => ipcRenderer.sendSync('app:getVersion'),
  },
  updater: {
    check: () => ipcRenderer.send('updater:check'),
    install: () => ipcRenderer.send('updater:install'),
    onStatus: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, status: 'downloading' | 'ready' | 'up-to-date' | 'error') => {
        callback(status);
      };
      ipcRenderer.on('updater:status', handler);
      return () => {
        ipcRenderer.removeListener('updater:status', handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
