import { useState, useEffect, useRef } from 'react';
import type { LayoutType, ClaudeMode, OpenDefault } from '../types';

interface HeaderBarProps {
  projectName: string | null;
  projectPath: string | null;
  sessionName: string | null;
  layout: LayoutType | null;
  onLayoutChange: (layout: LayoutType) => void;
  onNewSession: (() => void) | null;
  onRenameSession: ((name: string) => void) | null;
  onRunCommand: ((cmd: string) => void) | null;
  onRunScript: ((scriptName: string, cmd: string) => void) | null;
  serverUrl: string | null;
  claudeDefault: ClaudeMode;
  openDefault: OpenDefault;
}

const LAYOUTS: { type: LayoutType; label: string; icon: string }[] = [
  { type: 'single', label: 'Single', icon: '[ ]' },
  { type: 'hsplit', label: 'H-Split', icon: '[-]' },
  { type: 'vsplit', label: 'V-Split', icon: '[|]' },
  { type: 'three', label: '3 Pane', icon: '[=|]' },
  { type: 'grid', label: '2x2', icon: '[#]' },
];

const CLAUDE_OPTIONS: { mode: ClaudeMode; label: string; cmd: string }[] = [
  { mode: 'claude', label: 'Claude', cmd: 'claude\r' },
  { mode: 'claude-yolo', label: 'Claude --dangerously-skip-permissions', cmd: 'claude --dangerously-skip-permissions\r' },
];

const OPEN_OPTIONS: { mode: OpenDefault; label: string; icon: React.ReactNode }[] = [
  {
    mode: 'cursor',
    label: 'Cursor',
    icon: <img src="assets://cursor.svg" alt="" width="14" height="14" className="icon-invert" style={{ display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />,
  },
  {
    mode: 'explorer',
    label: 'Explorer',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4C2 3.44772 2.44772 3 3 3H6.5L8 5H13C13.5523 5 14 5.44772 14 6V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" />
      </svg>
    ),
  },
];

const btnBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--badge-bg)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
} as const;

export function HeaderBar({
  projectName,
  projectPath,
  sessionName,
  layout,
  onLayoutChange,
  onNewSession,
  onRenameSession,
  onRunCommand,
  onRunScript,
  serverUrl,
  claudeDefault,
  openDefault,
}: HeaderBarProps) {
  const [branch, setBranch] = useState('');
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [pkgManager, setPkgManager] = useState('npm');
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scriptsRef = useRef<HTMLDivElement>(null);
  const claudeRef = useRef<HTMLDivElement>(null);
  const openMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== sessionName && onRenameSession) {
      onRenameSession(trimmed);
    }
    setEditing(false);
  };

  useEffect(() => {
    if (!projectPath) {
      setBranch('');
      setScripts({});
      return;
    }
    window.electronAPI.git.getBranch(projectPath).then(setBranch);
    window.electronAPI.pkg.getScripts(projectPath).then(({ scripts, pm }) => {
      setScripts(scripts);
      setPkgManager(pm);
    });
  }, [projectPath]);

  // Close any open dropdown on outside click
  useEffect(() => {
    if (!scriptsOpen && !claudeOpen && !openMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (scriptsOpen && scriptsRef.current && !scriptsRef.current.contains(e.target as Node)) setScriptsOpen(false);
      if (claudeOpen && claudeRef.current && !claudeRef.current.contains(e.target as Node)) setClaudeOpen(false);
      if (openMenuOpen && openMenuRef.current && !openMenuRef.current.contains(e.target as Node)) setOpenMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [scriptsOpen, claudeOpen, openMenuOpen]);

  const claudeDefaultOption = CLAUDE_OPTIONS.find((o) => o.mode === claudeDefault) || CLAUDE_OPTIONS[0];
  const openDefaultOption = OPEN_OPTIONS.find((o) => o.mode === openDefault) || OPEN_OPTIONS[0];

  const handleOpen = (mode: OpenDefault) => {
    if (!projectPath) return;
    if (mode === 'cursor') window.electronAPI.shell.openInCursor(projectPath);
    else window.electronAPI.shell.openInExplorer(projectPath);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 40,
      padding: '0 12px',
      background: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Left: session name + project badge + branch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '0 6px',
              outline: 'none',
              width: 140,
            }}
          />
        ) : sessionName ? (
          <span
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'default' }}
            onDoubleClick={() => {
              if (onRenameSession) {
                setEditValue(sessionName);
                setEditing(true);
              }
            }}
          >
            {sessionName}
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            New thread
          </span>
        )}

        {projectName && (
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'var(--badge-bg)',
            color: 'var(--badge-text)',
          }}>
            {projectName}
          </span>
        )}

        {branch && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z" />
            </svg>
            {branch}
          </span>
        )}

        {serverUrl && (
          <button
            onClick={() => window.electronAPI.shell.openExternal(serverUrl)}
            title={`Open ${serverUrl} in browser`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 500,
              padding: '3px 8px',
              borderRadius: 4,
              background: 'var(--badge-bg)',
              color: 'var(--activity-serving)',
              border: '1px solid var(--border)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M1.5 8h13M8 1.5c-2 2.5-2 9.5 0 13M8 1.5c2 2.5 2 9.5 0 13" />
            </svg>
            {serverUrl.replace(/^https?:\/\//, '')}
          </button>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Scripts dropdown */}
        {projectPath && Object.keys(scripts).length > 0 && (
          <div ref={scriptsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setScriptsOpen(!scriptsOpen)}
              style={{
                ...btnBase,
                padding: '4px 10px',
                borderRadius: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 2.5L10.5 8L5.5 13.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Scripts
              <svg width="8" height="8" viewBox="0 0 8 8" style={{ marginLeft: 2 }}>
                <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {scriptsOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 0',
                zIndex: 1000,
                minWidth: 180,
                maxHeight: 300,
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                {Object.entries(scripts).map(([name, cmd]) => (
                  <button
                    key={name}
                    onClick={() => {
                      setScriptsOpen(false);
                      const fullCmd = `${pkgManager} run ${name}\r`;
                      if (onRunScript) {
                        onRunScript(name, fullCmd);
                      } else {
                        onRunCommand?.(fullCmd);
                      }
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 12px',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    title={cmd}
                  >
                    <div style={{ fontWeight: 500 }}>{name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cmd}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Claude split button */}
        {onRunCommand && (
          <div ref={claudeRef} style={{ position: 'relative', display: 'flex' }}>
            <button
              onClick={() => onRunCommand(claudeDefaultOption.cmd)}
              title={claudeDefaultOption.label}
              style={{
                ...btnBase,
                padding: '4px 10px',
                borderRadius: '5px 0 0 5px',
                borderRight: 'none',
              }}
            >
              <img src="assets://claude.svg" alt="" width="14" height="14" style={{ display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              Claude
            </button>
            <button
              onClick={() => setClaudeOpen(!claudeOpen)}
              style={{
                ...btnBase,
                padding: '4px 6px',
                borderRadius: '0 5px 5px 0',
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {claudeOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 0',
                zIndex: 1000,
                minWidth: 200,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                {CLAUDE_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => {
                      setClaudeOpen(false);
                      onRunCommand(opt.cmd);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 12px',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontWeight: opt.mode === claudeDefault ? 600 : 400,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {opt.mode === claudeDefault && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M1.5 5.5L4 8L8.5 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Open split button */}
        {projectPath && (
          <div ref={openMenuRef} style={{ position: 'relative', display: 'flex' }}>
            <button
              onClick={() => handleOpen(openDefault)}
              title={`Open in ${openDefaultOption.label}`}
              style={{
                ...btnBase,
                padding: '4px 10px',
                borderRadius: '5px 0 0 5px',
                borderRight: 'none',
              }}
            >
              {openDefaultOption.icon}
              {openDefaultOption.label}
            </button>
            <button
              onClick={() => setOpenMenuOpen(!openMenuOpen)}
              style={{
                ...btnBase,
                padding: '4px 6px',
                borderRadius: '0 5px 5px 0',
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {openMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 0',
                zIndex: 1000,
                minWidth: 160,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                {OPEN_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => {
                      setOpenMenuOpen(false);
                      handleOpen(opt.mode);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 12px',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontWeight: opt.mode === openDefault ? 600 : 400,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {opt.mode === openDefault && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M1.5 5.5L4 8L8.5 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
