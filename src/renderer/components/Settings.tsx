import { useState, useEffect } from 'react';
import type { ThemeMode, ClaudeMode, OpenDefault } from '../types';

const SHELL_PRESETS: { name: string; path: string; args: string[] }[] = [
  { name: 'Git Bash', path: '', args: [] },
  { name: 'PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', args: [] },
  { name: 'CMD', path: 'C:\\Windows\\System32\\cmd.exe', args: [] },
  { name: 'WSL', path: 'C:\\Windows\\System32\\wsl.exe', args: [] },
];

interface SettingsProps {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  terminalBgColor: string;
  onTerminalBgColorChange: (color: string) => void;
  shellPath: string;
  shellArgs: string[];
  onShellConfigChange: (path: string, args: string[]) => void;
  claudeDefault: ClaudeMode;
  onClaudeDefaultChange: (mode: ClaudeMode) => void;
  openDefault: OpenDefault;
  onOpenDefaultChange: (mode: OpenDefault) => void;
  autoCopy: boolean;
  onAutoCopyChange: (enabled: boolean) => void;
  rightClickPaste: boolean;
  onRightClickPasteChange: (enabled: boolean) => void;
  onClose: () => void;
}

const toggleBtnStyle = (active: boolean) => ({
  fontSize: 11,
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: active ? 'var(--badge-bg)' : 'var(--bg-surface)',
  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  fontWeight: active ? 600 : 400,
});

export function Settings({ theme, onThemeChange, terminalBgColor, onTerminalBgColorChange, shellPath, shellArgs, onShellConfigChange, claudeDefault, onClaudeDefaultChange, openDefault, onOpenDefaultChange, autoCopy, onAutoCopyChange, rightClickPaste, onRightClickPasteChange, onClose }: SettingsProps) {
  const [customPath, setCustomPath] = useState(shellPath);
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 40,
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Settings</span>
        <button onClick={onClose} style={{ fontSize: 16, color: 'var(--text-muted)' }}>x</button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Appearance */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 12,
          }}>
            Appearance
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onThemeChange('dark')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 8,
                border: theme === 'dark' ? '2px solid var(--text-secondary)' : '2px solid var(--border)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 48,
                height: 32,
                borderRadius: 4,
                background: '#1a191a',
                border: '1px solid #333',
              }} />
              <span style={{
                fontSize: 12,
                color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: theme === 'dark' ? 600 : 400,
              }}>
                Dark
              </span>
            </button>

            <button
              onClick={() => onThemeChange('day-dark')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 8,
                border: theme === 'day-dark' ? '2px solid var(--text-secondary)' : '2px solid var(--border)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 48,
                height: 32,
                borderRadius: 4,
                background: '#1c1c1d',
                border: '1px solid #333',
              }} />
              <span style={{
                fontSize: 12,
                color: theme === 'day-dark' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: theme === 'day-dark' ? 600 : 400,
              }}>
                Day Dark
              </span>
            </button>

            <button
              onClick={() => onThemeChange('light')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 8,
                border: theme === 'light' ? '2px solid var(--text-secondary)' : '2px solid var(--border)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 48,
                height: 32,
                borderRadius: 4,
                background: '#fafafa',
                border: '1px solid #ddd',
              }} />
              <span style={{
                fontSize: 12,
                color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: theme === 'light' ? 600 : 400,
              }}>
                Light
              </span>
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 12,
          }}>
            Terminal
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Background Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={terminalBgColor}
                onChange={(e) => onTerminalBgColorChange(e.target.value)}
                style={{
                  width: 32,
                  height: 24,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: 0,
                  cursor: 'pointer',
                  background: 'none',
                }}
              />
              <input
                type="text"
                value={terminalBgColor}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                    onTerminalBgColorChange(v);
                  }
                }}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                    onTerminalBgColorChange(v);
                  }
                }}
                style={{
                  width: 80,
                  fontSize: 12,
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                }}
              />
              <button
                onClick={() => onTerminalBgColorChange('#171717')}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Shell Path */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Shell
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {SHELL_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setCustomPath(preset.path);
                      onShellConfigChange(preset.path, preset.args);
                    }}
                    style={toggleBtnStyle((shellPath || '') === preset.path)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                value={customPath}
                placeholder="Auto-detect (Git Bash)"
                onChange={(e) => setCustomPath(e.target.value)}
                onBlur={() => onShellConfigChange(customPath, shellArgs)}
                onKeyDown={(e) => { if (e.key === 'Enter') onShellConfigChange(customPath, shellArgs); }}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '5px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                }}
              />
              <button
                onClick={async () => {
                  const file = await window.electronAPI.dialog.openFile();
                  if (file) {
                    setCustomPath(file);
                    onShellConfigChange(file, shellArgs);
                  }
                }}
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                Browse
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              New sessions will use this shell. Existing sessions keep their current shell.
            </div>
          </div>

          {/* Copy / Paste */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 140 }}>
                Auto Copy on Select
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onAutoCopyChange(true)} style={toggleBtnStyle(autoCopy)}>
                  On
                </button>
                <button onClick={() => onAutoCopyChange(false)} style={toggleBtnStyle(!autoCopy)}>
                  Off
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 140 }}>
                Right Click to Paste
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onRightClickPasteChange(true)} style={toggleBtnStyle(rightClickPaste)}>
                  On
                </button>
                <button onClick={() => onRightClickPasteChange(false)} style={toggleBtnStyle(!rightClickPaste)}>
                  Off
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              When enabled, selecting text auto-copies it and right-click pastes directly (skipping the context menu).
            </div>
          </div>
        </div>

        {/* Defaults */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 12,
          }}>
            Defaults
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 100 }}>
              AI Button
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onClaudeDefaultChange('claude')} style={{ ...toggleBtnStyle(claudeDefault === 'claude'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#4ade8033" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                claude
              </button>
              <button onClick={() => onClaudeDefaultChange('claude-yolo')} style={{ ...toggleBtnStyle(claudeDefault === 'claude-yolo'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#f8717133" />
                  <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
                claude (skip perms)
              </button>
              <button onClick={() => onClaudeDefaultChange('codex')} style={{ ...toggleBtnStyle(claudeDefault === 'codex'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <img src="assets://openai.svg" alt="" width="12" height="12" className="icon-invert" style={{ display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                codex
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 100 }}>
              Open Button
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onOpenDefaultChange('cursor')} style={toggleBtnStyle(openDefault === 'cursor')}>
                Cursor
              </button>
              <button onClick={() => onOpenDefaultChange('explorer')} style={toggleBtnStyle(openDefault === 'explorer')}>
                Explorer
              </button>
            </div>
          </div>
        </div>

        {/* Updates */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 12,
          }}>
            Updates
          </div>
          <UpdateCheck />
        </div>
      </div>
    </div>
  );
}

function UpdateCheck() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error'>('idle');

  useEffect(() => {
    const removeListener = window.electronAPI.updater.onStatus((s) => {
      if (s === 'downloading') setStatus('downloading');
      else if (s === 'ready') setStatus('ready');
      else if (s === 'up-to-date') setStatus('up-to-date');
      else if (s === 'error') setStatus('error');
    });
    return removeListener;
  }, []);

  const handleCheck = () => {
    setStatus('checking');
    window.electronAPI.updater.check();
    // If no status comes back within 10s, assume up-to-date
    setTimeout(() => {
      setStatus((prev) => prev === 'checking' ? 'up-to-date' : prev);
    }, 10000);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        v{window.electronAPI.app.getVersion()}
      </span>
      {status === 'ready' ? (
        <button
          onClick={() => window.electronAPI.updater.install()}
          style={{
            fontSize: 11,
            padding: '5px 14px',
            borderRadius: 4,
            border: '1px solid var(--success)',
            background: 'var(--bg-surface)',
            color: 'var(--success)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Update ready — restart to install
        </button>
      ) : (
        <button
          onClick={handleCheck}
          disabled={status === 'checking' || status === 'downloading'}
          style={{
            fontSize: 11,
            padding: '5px 14px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            cursor: status === 'checking' || status === 'downloading' ? 'default' : 'pointer',
            opacity: status === 'checking' || status === 'downloading' ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {status === 'checking' && <Spinner />}
          {status === 'downloading' && <Spinner />}
          {status === 'checking' ? 'Checking...'
            : status === 'downloading' ? 'Downloading...'
            : 'Check for Updates'}
        </button>
      )}
      {status === 'up-to-date' && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>You're up to date</span>
      )}
      {status === 'error' && (
        <span style={{ fontSize: 11, color: 'var(--danger)' }}>Update check failed</span>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" style={{ animation: 'hb-spin 0.8s linear infinite' }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
