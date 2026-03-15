import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu, autoUpdater } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import started from 'electron-squirrel-startup';
import { createPty, writePty, resizePty, killPty, killAll } from './pty-manager';
import { loadStore, saveStore } from './store';

if (started) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'assets', privileges: { bypassCSP: true, supportFetchAPI: true } },
]);

let mainWindow: BrowserWindow | null = null;
const gotSingleInstanceLock = !started && app.requestSingleInstanceLock();

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'icon.ico')
      : path.join(__dirname, '../../assets/icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#171717',
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (process.env.NODE_ENV === 'development' || MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

// --- IPC Handlers ---

function setupIPC() {
  // PTY
  ipcMain.handle('pty:create', (_event, cwd?: string, shellPath?: string, shellArgs?: string[]) => {
    return createPty((ptyId, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:data', ptyId, data);
      }
    }, cwd, shellPath, shellArgs);
  });

  ipcMain.on('pty:write', (_event, ptyId: string, data: string) => {
    writePty(ptyId, data);
  });

  ipcMain.on('pty:resize', (_event, ptyId: string, cols: number, rows: number) => {
    resizePty(ptyId, cols, rows);
  });

  ipcMain.on('pty:kill', (_event, ptyId: string) => {
    killPty(ptyId);
  });

  // App
  ipcMain.on('app:getVersion', (event) => {
    event.returnValue = app.getVersion();
  });

  // Store
  ipcMain.handle('store:load', () => loadStore());
  ipcMain.handle('store:save', (_event, data) => saveStore(data));

  // Git
  ipcMain.handle('git:getBranch', (_event, cwd: string) => {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  });

  // Shell
  ipcMain.on('shell:openInCursor', (_event, cwd: string) => {
    try {
      execSync(`cursor "${cwd}"`, { cwd });
    } catch {
      try {
        execSync(`code "${cwd}"`, { cwd });
      } catch {
        // neither available
      }
    }
  });

  ipcMain.on('shell:openInExplorer', (_event, cwd: string) => {
    shell.openPath(cwd);
  });

  ipcMain.on('shell:openExternal', (_event, url: string) => {
    // Only allow localhost URLs for security
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/.test(url)) {
      shell.openExternal(url);
    }
  });

  // Package.json scripts + package manager detection
  ipcMain.handle('pkg:getScripts', (_event, cwd: string) => {
    try {
      const pkgPath = path.join(cwd, 'package.json');
      const content = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const scripts = pkg.scripts || {};

      // Detect package manager from lock files
      let pm = 'npm';
      if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) pm = 'pnpm';
      else if (fs.existsSync(path.join(cwd, 'yarn.lock'))) pm = 'yarn';
      else if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) pm = 'bun';

      return { scripts, pm };
    } catch {
      return { scripts: {}, pm: 'npm' };
    }
  });

  // Dialog
  ipcMain.handle('dialog:openFile', async (_event, filters?: { name: string; extensions: string[] }[]) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: 'Executables', extensions: ['exe', 'cmd', 'bat', 'com', '*'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

// --- Auto-updater ---
function setupUpdater() {
  if (!app.isPackaged) return; // Skip in dev mode

  const repo = 'sandan-dominik/arccode';
  const feedURL = `https://update.electronjs.org/${repo}/${process.platform}-${process.arch}/${app.getVersion()}`;

  console.log('[updater] Feed URL:', feedURL);

  try {
    autoUpdater.setFeedURL({ url: feedURL });
  } catch (e) {
    console.error('[updater] Failed to set feed URL:', e);
    return;
  }

  autoUpdater.on('update-available', () => {
    console.log('[updater] Update available, downloading...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', 'downloading');
    }
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[updater] Update downloaded, ready to install');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', 'ready');
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] No update available');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', 'up-to-date');
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', 'error');
    }
  });

  // Check for updates on IPC request
  ipcMain.on('updater:check', () => {
    try {
      autoUpdater.checkForUpdates();
    } catch {
      // Feed URL not set or network error
    }
  });

  // Quit and install on IPC request
  ipcMain.on('updater:install', () => {
    autoUpdater.quitAndInstall();
  });

  // Auto-check on startup after a short delay, then every 30 minutes
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates();
    } catch {
      // ignore
    }
  }, 5000);

  setInterval(() => {
    try {
      autoUpdater.checkForUpdates();
    } catch {
      // ignore
    }
  }, 30 * 60 * 1000);
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    focusMainWindow();
  });

  app.on('ready', () => {
  // Set GPU cache path to avoid "Unable to move the cache" errors on Windows
  try {
    app.setPath('gpu-cache', path.join(app.getPath('userData'), 'gpu-cache'));
  } catch {
    // Silently ignore — not all Electron versions support setting gpu-cache path
  }
  // Remove default menu so it doesn't capture keyboard shortcuts
  Menu.setApplicationMenu(null);
  protocol.handle('assets', (request) => {
    const fileName = request.url.replace('assets://', '');
    const filePath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', fileName)
      : path.join(__dirname, '../../assets', fileName);
    return net.fetch(`file://${filePath}`);
  });
  setupIPC();
  createWindow();
  setupUpdater();
});

app.on('before-quit', () => {
  killAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    focusMainWindow();
  }
});
}
