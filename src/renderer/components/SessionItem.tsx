import { useState, useRef, useEffect } from 'react';
import type { Session } from '../types';

interface SessionItemProps {
  session: Session;
  index: number;
  isActive: boolean;
  isSelected?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  dropTarget: 'above' | 'below' | null;
  activity: 'idle' | 'completed' | 'busy' | 'serving' | 'error' | null;
  serverUrl: string | null;
  onToggleSelect?: () => void;
  onPrepareGrouping?: () => void;
  onGroupSelected?: () => void;
  selectedCount?: number;
  groupActionLabel?: string;
  disableDrag?: boolean;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function SessionItem({ session, index, isActive, isSelected, onSelect, onRemove, onRename, onDragStart, onDragOver, onDrop, dropTarget, activity, serverUrl, onToggleSelect, onPrepareGrouping, onGroupSelected, selectedCount = 0, groupActionLabel = 'Group Sessions', disableDrag }: SessionItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [groupMenu, setGroupMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.name);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contextMenu && !groupMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setConfirmRemove(false);
      }
      if (groupMenu && groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setGroupMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu, groupMenu]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const effectiveGroupCount = isSelected ? selectedCount : selectedCount + 1;

  return (
    <div
      draggable={!disableDrag}
      onDragStart={disableDrag ? undefined : (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(index);
      }}
      onDragOver={disableDrag ? undefined : (e) => {
        e.stopPropagation();
        onDragOver(e, index);
      }}
      onDrop={disableDrag ? undefined : (e) => {
        e.stopPropagation();
        onDrop(index);
      }}
      onClick={(e) => {
        if (e.ctrlKey && onToggleSelect) {
          e.stopPropagation();
          onToggleSelect();
          return;
        }
        onSelect();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onPrepareGrouping?.();
        if (isSelected || selectedCount >= 1) {
          setGroupMenu({ x: e.clientX, y: e.clientY });
        } else {
          setConfirmRemove(false);
          setContextMenu({ x: e.clientX, y: e.clientY });
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '6px 12px',
        cursor: disableDrag ? 'pointer' : 'grab',
        background: isActive || isSelected ? 'var(--bg-hover)' : 'transparent',
        borderRadius: 4,
        margin: '0 4px 2px',
        outline: isSelected && !isActive ? '1px solid var(--border)' : 'none',
        borderTop: dropTarget === 'above' ? '2px solid var(--text-secondary)' : '2px solid transparent',
        borderBottom: dropTarget === 'below' ? '2px solid var(--text-secondary)' : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive && !isSelected) e.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive && !isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {activity === 'idle' && (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--text-muted)',
            flexShrink: 0,
            marginTop: 4,
            marginRight: 10,
          }}
          title="Idle"
        />
      )}
      {activity === 'completed' && (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--success)',
            flexShrink: 0,
            marginTop: 4,
            marginRight: 10,
          }}
          title="Completed"
        />
      )}
      {activity === 'busy' && (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--activity-busy)',
            animation: 'pulse 1.5s ease-in-out infinite',
            flexShrink: 0,
            marginTop: 4,
            marginRight: 10,
          }}
          title="Running"
        />
      )}
      {activity === 'serving' && (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--activity-serving)',
            flexShrink: 0,
            marginTop: 4,
            marginRight: 10,
          }}
          title="Server running"
        />
      )}
      {activity === 'error' && (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--danger)',
            flexShrink: 0,
            marginTop: 4,
            marginRight: 10,
          }}
          title="Error"
        />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
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
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 12,
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              padding: '0 4px',
              outline: 'none',
              lineHeight: 1.4,
            }}
          />
        ) : (
          <>
            <div style={{
              fontSize: 12,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.4,
            }}>
              {session.name}
            </div>
            {serverUrl && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  window.electronAPI.shell.openExternal(serverUrl);
                }}
                style={{
                  fontSize: 10,
                  color: 'var(--activity-serving)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title={`Open ${serverUrl} in browser`}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M1.5 8h13M8 1.5c-2 2.5-2 9.5 0 13M8 1.5c2 2.5 2 9.5 0 13" />
                </svg>
                {serverUrl.replace(/^https?:\/\//, '')}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
        <span style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}>
          {timeAgo(session.createdAt)}
        </span>
      </div>

      {groupMenu && (
        <div
          ref={groupMenuRef}
          style={{
            position: 'fixed',
            left: groupMenu.x,
            top: groupMenu.y,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 1000,
            minWidth: 160,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {effectiveGroupCount} sessions selected
          </div>
          {onGroupSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGroupMenu(null);
                onPrepareGrouping?.();
                onGroupSelected();
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {groupActionLabel}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setGroupMenu(null);
              onToggleSelect?.();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 12px',
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Deselect
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 1000,
            minWidth: 130,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {onToggleSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                onToggleSelect();
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
            >
              Select for Group
            </button>
          )}
          {onGroupSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                onPrepareGrouping?.();
                onGroupSelected();
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
            >
              {groupActionLabel}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(null);
              setEditValue(session.name);
              setEditing(true);
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
          >
            Rename
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {confirmRemove ? (
            <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--danger)' }}>Remove?</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu(null);
                  setConfirmRemove(false);
                  onRemove();
                }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--danger)',
                  border: 'none',
                  borderRadius: 3,
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmRemove(false);
                }}
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmRemove(true);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--danger)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
