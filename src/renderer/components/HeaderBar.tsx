import { useState, useEffect, useRef } from 'react';
import type { ClaudeMode, OpenDefault } from '../types';

interface HeaderBarProps {
  projectName: string | null;
  projectPath: string | null;
  sessionName: string | null;
  onRenameSession: ((name: string) => void) | null;
  onRunCommand: ((cmd: string) => void) | null;
  onRunScript: ((scriptName: string, cmd: string) => void) | null;
  serverUrl: string | null;
  claudeDefault: ClaudeMode;
  openDefault: OpenDefault;
  groupColor?: string | null;
  onGroupColorChange?: ((color: string) => void) | null;
}

const CLAUDE_SHIELD_GREEN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#4ade8033" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const CLAUDE_SHIELD_RED = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#f8717133" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </svg>
);

const CODEX_ICON = (
  <img src="assets://openai.svg" alt="" width="14" height="14" className="icon-invert" style={{ display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
);

const AI_OPTIONS: { mode: ClaudeMode; label: string; icon: React.ReactNode; cmd: string; brandIcon?: React.ReactNode }[] = [
  { mode: 'claude', label: 'Claude', icon: CLAUDE_SHIELD_GREEN, cmd: 'claude\r' },
  { mode: 'claude-yolo', label: 'Claude (skip permissions)', icon: CLAUDE_SHIELD_RED, cmd: 'claude --dangerously-skip-permissions\r' },
  { mode: 'codex', label: 'Codex', icon: CODEX_ICON, cmd: 'codex\r', brandIcon: CODEX_ICON },
  { mode: 'codex-yolo', label: 'Codex yolo', icon: CODEX_ICON, cmd: 'codex --ask-for-approval never --sandbox workspace-write\r', brandIcon: CODEX_ICON },
  { mode: 'codex-full-yolo', label: 'Codex full yolo', icon: CODEX_ICON, cmd: 'codex --ask-for-approval never --sandbox danger-full-access\r', brandIcon: CODEX_ICON },
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

const Spinner = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ animation: 'hb-spin 0.8s linear infinite' }}>
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
    <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Inject spinner keyframes once
if (typeof document !== 'undefined' && !document.getElementById('hb-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'hb-spinner-style';
  style.textContent = '@keyframes hb-spin { to { transform: rotate(360deg) } }';
  document.head.appendChild(style);
}

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
  onRenameSession,
  onRunCommand,
  onRunScript,
  serverUrl,
  claudeDefault,
  openDefault,
  groupColor,
  onGroupColorChange,
}: HeaderBarProps) {
  const [branch, setBranch] = useState('');
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [pkgManager, setPkgManager] = useState('npm');
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandActiveIndex, setCommandActiveIndex] = useState(0);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [scriptLoading, setScriptLoading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const scriptsRef = useRef<HTMLDivElement>(null);
  const claudeRef = useRef<HTMLDivElement>(null);
  const openMenuRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (commandOpen && commandInputRef.current) {
      commandInputRef.current.focus();
      commandInputRef.current.select();
    }
  }, [commandOpen]);

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
    if (!scriptsOpen && !claudeOpen && !openMenuOpen && !colorPickerOpen && !commandOpen) return;
    const handler = (e: MouseEvent) => {
      if (scriptsOpen && scriptsRef.current && !scriptsRef.current.contains(e.target as Node)) setScriptsOpen(false);
      if (claudeOpen && claudeRef.current && !claudeRef.current.contains(e.target as Node)) setClaudeOpen(false);
      if (openMenuOpen && openMenuRef.current && !openMenuRef.current.contains(e.target as Node)) setOpenMenuOpen(false);
      if (colorPickerOpen && colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) setColorPickerOpen(false);
      if (commandOpen && commandRef.current && !commandRef.current.contains(e.target as Node)) setCommandOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [scriptsOpen, claudeOpen, openMenuOpen, colorPickerOpen, commandOpen]);

  const claudeDefaultOption = AI_OPTIONS.find((o) => o.mode === claudeDefault) || AI_OPTIONS[0];
  const openDefaultOption = OPEN_OPTIONS.find((o) => o.mode === openDefault) || OPEN_OPTIONS[0];

  const handleOpen = (mode: OpenDefault) => {
    if (!projectPath || openLoading) return;
    if (mode === 'cursor') window.electronAPI.shell.openInCursor(projectPath);
    else window.electronAPI.shell.openInExplorer(projectPath);
    setOpenLoading(true);
    setTimeout(() => setOpenLoading(false), 5000);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'k') return;

      const target = event.target as HTMLElement | null;
      const isTypingTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTypingTarget) return;

      event.preventDefault();
      setCommandQuery('');
      setCommandActiveIndex(0);
      setCommandOpen(true);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCommandOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const commandItems: { id: string; label: string; detail: string; keywords: string; icon: React.ReactNode; action: () => void }[] = [
    ...Object.entries(scripts).map(([name, cmd]) => ({
      id: `script:${name}`,
      label: `Run script: ${name}`,
      detail: cmd,
      keywords: `${name} ${cmd} script run ${pkgManager}`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5.5 2.5L10.5 8L5.5 13.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      action: () => {
        const fullCmd = `${pkgManager} run ${name}\r`;
        setScriptLoading(name);
        setTimeout(() => setScriptLoading(null), 2000);
        if (onRunScript) onRunScript(name, fullCmd);
        else onRunCommand?.(fullCmd);
      },
    })),
    ...AI_OPTIONS.map((opt) => ({
      id: `ai:${opt.mode}`,
      label: opt.label,
      detail: 'Run in terminal',
      keywords: `${opt.label} ai terminal ${opt.mode}`,
      icon: opt.brandIcon || opt.icon,
      action: () => onRunCommand?.(opt.cmd),
    })),
    ...OPEN_OPTIONS.map((opt) => ({
      id: `open:${opt.mode}`,
      label: `Open in ${opt.label}`,
      detail: projectPath || '',
      keywords: `${opt.label} open project folder`,
      icon: opt.icon,
      action: () => handleOpen(opt.mode),
    })),
  ].filter((item) => {
    if (item.id.startsWith('script:')) return projectPath && Object.keys(scripts).length > 0;
    if (item.id.startsWith('ai:')) return !!onRunCommand;
    if (item.id.startsWith('open:')) return !!projectPath;
    return true;
  });

  const normalizedCommandQuery = commandQuery.trim().toLowerCase();
  const filteredCommandItems = normalizedCommandQuery
    ? commandItems.filter((item) => `${item.label} ${item.detail} ${item.keywords}`.toLowerCase().includes(normalizedCommandQuery))
    : commandItems;

  useEffect(() => {
    if (!commandOpen) return;
    setCommandActiveIndex(0);
  }, [commandOpen, normalizedCommandQuery]);

  const runCommandItem = (index: number) => {
    const item = filteredCommandItems[index];
    if (!item) return;
    setCommandOpen(false);
    item.action();
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
        ) : null}

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

        {onGroupColorChange ? (
          <div ref={colorPickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setColorPickerOpen(!colorPickerOpen)}
              title="Group color"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'var(--badge-bg)',
                border: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: groupColor || '#ef4444',
                border: '1px solid rgba(255,255,255,0.2)',
              }} />
              <svg width="8" height="8" viewBox="0 0 8 8" style={{ marginLeft: 1 }}>
                <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {colorPickerOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 8,
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 6,
              }}>
                {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#f5f5f5'].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      onGroupColorChange(c);
                      setColorPickerOpen(false);
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: c,
                      border: (groupColor || '#ef4444') === c ? '2px solid var(--text-primary)' : '1px solid rgba(255,255,255,0.15)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : branch ? (
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
        ) : null}

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
        <button
          onClick={() => {
            setCommandQuery('');
            setCommandActiveIndex(0);
            setCommandOpen(true);
          }}
          style={{
            ...btnBase,
            padding: '4px 10px',
            borderRadius: 5,
          }}
        >
          Command
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ctrl+K</span>
        </button>

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
                {Object.entries(scripts).map(([name, cmd]) => {
                  const isLoading = scriptLoading === name;
                  return (
                    <button
                      key={name}
                      disabled={isLoading}
                      onClick={() => {
                        setScriptsOpen(false);
                        setScriptLoading(name);
                        setTimeout(() => setScriptLoading(null), 2000);
                        const fullCmd = `${pkgManager} run ${name}\r`;
                        if (onRunScript) {
                          onRunScript(name, fullCmd);
                        } else {
                          onRunCommand?.(fullCmd);
                        }
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
                        opacity: isLoading ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title={cmd}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cmd}</div>
                      </div>
                      {isLoading && <Spinner />}
                    </button>
                  );
                })}
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
              {claudeDefault === 'codex' || claudeDefault === 'codex-yolo' || claudeDefault === 'codex-full-yolo'
                ? <img src="assets://openai.svg" alt="" width="14" height="14" className="icon-invert" style={{ display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <img src="assets://claude.svg" alt="" width="14" height="14" style={{ display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              }
              {claudeDefaultOption.label}
              {claudeDefault !== 'codex' && claudeDefault !== 'codex-yolo' && claudeDefault !== 'codex-full-yolo' && claudeDefaultOption.icon}
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
                {AI_OPTIONS.map((opt) => (
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
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {opt.icon}
                    {opt.label}
                    <span style={{ marginLeft: 'auto' }}>
                      {opt.mode === claudeDefault && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M1.5 5.5L4 8L8.5 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
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
              disabled={openLoading}
              title={`Open in ${openDefaultOption.label}`}
              style={{
                ...btnBase,
                padding: '4px 10px',
                borderRadius: '5px 0 0 5px',
                borderRight: 'none',
                opacity: openLoading ? 0.6 : 1,
                cursor: openLoading ? 'default' : undefined,
              }}
            >
              {openLoading ? <Spinner /> : openDefaultOption.icon}
              {openDefaultOption.label}
            </button>
            <button
              onClick={() => setOpenMenuOpen(!openMenuOpen)}
              disabled={openLoading}
              style={{
                ...btnBase,
                padding: '4px 6px',
                borderRadius: '0 5px 5px 0',
                opacity: openLoading ? 0.6 : 1,
                cursor: openLoading ? 'default' : undefined,
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
                    {opt.icon}
                    {opt.label}
                    <span style={{ marginLeft: 'auto' }}>
                      {opt.mode === openDefault && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M1.5 5.5L4 8L8.5 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {commandOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.18)',
            zIndex: 1500,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 72,
          }}
        >
          <div
            ref={commandRef}
            style={{
              width: 560,
              maxWidth: 'calc(100vw - 40px)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCommandActiveIndex((current) => Math.min(current + 1, Math.max(filteredCommandItems.length - 1, 0)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCommandActiveIndex((current) => Math.max(current - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    runCommandItem(commandActiveIndex);
                  }
                }}
                placeholder="Search scripts, Claude, Codex, Cursor, Explorer..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
              {filteredCommandItems.length === 0 ? (
                <div style={{ padding: '18px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                  No matching commands.
                </div>
              ) : filteredCommandItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => {
                    runCommandItem(index);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    background: commandActiveIndex === index ? 'var(--bg-hover)' : 'transparent',
                  }}
                  onMouseEnter={() => setCommandActiveIndex(index)}
                >
                  <div style={{ width: 18, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{item.label}</div>
                    {item.detail && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.detail}
                      </div>
                    )}
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {item.id.startsWith('script:') ? 'Script' : item.id.startsWith('ai:') ? 'AI' : 'Open'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
