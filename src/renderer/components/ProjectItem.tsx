import { useState, useRef, useEffect } from 'react';
import type { Project } from '../types';
import { SessionItem } from './SessionItem';

interface ProjectItemProps {
  project: Project;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onAddSession: () => void;
  onRemoveSession: (sessionId: string) => void;
  onRemoveProject: () => void;
  onRenameSession: (sessionId: string, name: string) => void;
  onReorderSessions: (projectId: string, fromIndex: number, toIndex: number) => void;
  sessionActivity: Record<string, 'idle' | 'completed' | 'busy' | 'serving'>;
  sessionServerUrls: Record<string, string>;
}

export function ProjectItem({
  project,
  activeSessionId,
  onSelectSession,
  onAddSession,
  onRemoveSession,
  onRemoveProject,
  onRenameSession,
  onReorderSessions,
  sessionActivity,
  sessionServerUrls,
}: ProjectItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dropIndex, setDropIndex] = useState<{ index: number; position: 'above' | 'below' } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 12px 5px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" style={{
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
          }}>
            <path d="M2 3L5 6L8 3" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M2 4C2 3.44772 2.44772 3 3 3H6.5L8 5H13C13.5523 5 14 5.44772 14 6V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" stroke="var(--text-muted)" strokeWidth="1.2" />
          </svg>
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {project.name}
          </span>
        </div>
        {hovered && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAddSession(); }}
              title="New session"
              style={{ padding: '0 3px', color: 'var(--text-muted)', lineHeight: 1, display: 'flex', alignItems: 'center' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
                <path d="M4.5 6.5L7 9L4.5 11.5" />
                <path d="M8.5 11.5H11.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
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
            minWidth: 140,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <button
            onClick={() => { setContextMenu(null); onAddSession(); }}
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
            New Session
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button
            onClick={() => { setContextMenu(null); onRemoveProject(); }}
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
            Remove Project
          </button>
        </div>
      )}

      {expanded && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={() => { dragIndexRef.current = null; setDropIndex(null); }}
          style={{
            marginLeft: 20,
            borderLeft: '1px solid var(--border)',
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          {project.sessions.map((session, i) => (
            <SessionItem
              key={session.id}
              session={session}
              index={i}
              isActive={session.id === activeSessionId}
              onSelect={() => onSelectSession(session.id)}
              onRemove={() => onRemoveSession(session.id)}
              onRename={(name) => onRenameSession(session.id, name)}
              activity={sessionActivity[session.id] || null}
              serverUrl={sessionServerUrls[session.id] || null}
              onDragStart={(idx) => { dragIndexRef.current = idx; }}
              onDragOver={(e, idx) => {
                e.preventDefault();
                if (dragIndexRef.current === null || dragIndexRef.current === idx) {
                  setDropIndex(null);
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                const position = e.clientY < mid ? 'above' : 'below';
                setDropIndex({ index: idx, position });
              }}
              onDrop={(idx) => {
                if (dragIndexRef.current === null || dragIndexRef.current === idx) return;
                const from = dragIndexRef.current;
                let to = idx;
                if (dropIndex?.position === 'below') to = idx + (from < idx ? 0 : 1);
                else to = idx - (from < idx ? 1 : 0);
                if (from !== to) onReorderSessions(project.id, from, to);
                dragIndexRef.current = null;
                setDropIndex(null);
              }}
              dropTarget={dropIndex?.index === i ? dropIndex.position : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
