import { useState, useRef, useEffect } from 'react';
import type { LayoutType, Project, Session, SessionGroup } from '../types';
import { SessionItem } from './SessionItem';

function getDefaultGroupLayout(count: number): LayoutType {
  if (count >= 4) return 'grid';
  if (count === 3) return 'three';
  if (count === 2) return 'vsplit';
  return 'single';
}

interface ProjectItemProps {
  project: Project;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onAddSession: () => void;
  onRemoveSession: (sessionId: string) => void;
  onRemoveProject: () => void;
  onRenameSession: (sessionId: string, name: string) => void;
  onReorderSessions: (projectId: string, fromIndex: number, toIndex: number) => void;
  onReorderGroupSessions: (projectId: string, sessionIds: string[], toIndex: number) => void;
  sessionActivity: Record<string, 'idle' | 'completed' | 'busy' | 'serving' | 'error'>;
  sessionServerUrls: Record<string, string>;
  selectedSessionIds: Set<string>;
  onToggleSelectSession: (sessionId: string) => void;
  sessionGroups: SessionGroup[];
  onGroupSessions: (sessionIds: string[]) => void;
  onUngroupSessions: (groupId: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onSetGroupLayout: (groupId: string, layout: LayoutType) => void;
  activeGroupId: string | null;
  dropTarget: 'above' | 'below' | null;
  onProjectDragStart: () => void;
  onProjectDragOver: (e: React.DragEvent) => void;
  onProjectDrop: () => void;
  onProjectDragEnd: () => void;
}

type Slot =
  | { type: 'session'; session: Session; sessionIndex: number }
  | { type: 'group'; group: SessionGroup; sessions: Session[]; firstSessionIndex: number; color: string };

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
  onReorderGroupSessions,
  sessionActivity,
  sessionServerUrls,
  selectedSessionIds,
  onToggleSelectSession,
  sessionGroups,
  onGroupSessions,
  onUngroupSessions,
  onRenameGroup,
  onSetGroupLayout,
  activeGroupId,
  dropTarget,
  onProjectDragStart,
  onProjectDragOver,
  onProjectDrop,
  onProjectDragEnd,
}: ProjectItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupValue, setEditGroupValue] = useState('');
  const groupInputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmRemoveProject, setConfirmRemoveProject] = useState(false);
  const [groupContextMenu, setGroupContextMenu] = useState<{ x: number; y: number; groupId: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  // Slot-based drag/drop
  const dragSlotRef = useRef<number | null>(null);
  const [dropSlot, setDropSlot] = useState<{ slotIndex: number; position: 'above' | 'below' } | null>(null);

  // Build visual slots
  const slots: Slot[] = [];
  const renderedInGroup = new Set<string>();
  project.sessions.forEach((session, i) => {
    if (renderedInGroup.has(session.id)) return;
    const group = sessionGroups.find((g) => g.sessionIds.includes(session.id));
    if (group) {
      const groupSessions = group.sessionIds
        .map((id) => project.sessions.find((s) => s.id === id))
        .filter(Boolean) as Session[];
      if (groupSessions.length > 0) {
        for (const groupSession of groupSessions) renderedInGroup.add(groupSession.id);
        slots.push({ type: 'group', group, sessions: groupSessions, firstSessionIndex: i, color: group.color || '#ef4444' });
        return;
      }
    }
    slots.push({ type: 'session', session, sessionIndex: i });
  });

  const handleSlotDragOver = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    if (dragSlotRef.current === null || dragSlotRef.current === slotIndex) {
      setDropSlot(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const position = e.clientY < mid ? 'above' : 'below';
    setDropSlot({ slotIndex, position });
  };

  const handleSlotDrop = (targetSlotIndex: number) => {
    const fromSlotIndex = dragSlotRef.current;
    if (fromSlotIndex === null || fromSlotIndex === targetSlotIndex) return;
    const fromSlot = slots[fromSlotIndex];
    const targetSlot = slots[targetSlotIndex];
    const pos = dropSlot?.position || 'above';

    // Calculate the target session index
    let targetSessionIndex: number;
    if (targetSlot.type === 'session') {
      targetSessionIndex = pos === 'below' ? targetSlot.sessionIndex + 1 : targetSlot.sessionIndex;
    } else {
      if (pos === 'above') {
        targetSessionIndex = targetSlot.firstSessionIndex;
      } else {
        // After last session in target group
        const maxIdx = Math.max(
          ...targetSlot.group.sessionIds.map((id) => project.sessions.findIndex((s) => s.id === id))
        );
        targetSessionIndex = maxIdx + 1;
      }
    }

    if (fromSlot.type === 'session') {
      const from = fromSlot.sessionIndex;
      let to = targetSessionIndex;
      // Adjust for single-item removal
      if (from < to) to--;
      if (from !== to) onReorderSessions(project.id, from, to);
    } else {
      onReorderGroupSessions(project.id, fromSlot.group.sessionIds, targetSessionIndex);
    }
    dragSlotRef.current = null;
    setDropSlot(null);
  };

  useEffect(() => {
    if (editingGroupId && groupInputRef.current) {
      groupInputRef.current.focus();
      groupInputRef.current.select();
    }
  }, [editingGroupId]);

  useEffect(() => {
    if (!contextMenu && !groupContextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (groupContextMenu && groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setGroupContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu, groupContextMenu]);

  const selectedProjectSessionIds = project.sessions
    .filter((session) => selectedSessionIds.has(session.id))
    .map((session) => session.id)
    .slice(0, 4);

  const getGroupSessionIds = (anchorSessionId: string) => {
    const nextIds = selectedProjectSessionIds.includes(anchorSessionId)
      ? selectedProjectSessionIds
      : [anchorSessionId, ...selectedProjectSessionIds];
    return [...new Set(nextIds)].slice(0, 4);
  };

  const groupActionLabel = selectedProjectSessionIds.length <= 1
    ? 'Create Group'
    : `Group ${selectedProjectSessionIds.length} Sessions`;

  return (
    <div
      style={{
        borderTop: dropTarget === 'above' ? '2px solid var(--text-secondary)' : '2px solid transparent',
        borderBottom: dropTarget === 'below' ? '2px solid var(--text-secondary)' : '2px solid transparent',
      }}
    >
      <div
        draggable
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px 6px 12px',
          cursor: 'grab',
          userSelect: 'none',
        }}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onProjectDragStart();
        }}
        onDragOver={onProjectDragOver}
        onDrop={onProjectDrop}
        onDragEnd={onProjectDragEnd}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={(e) => {
          e.preventDefault();
          setConfirmRemoveProject(false);
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
          {confirmRemoveProject ? (
            <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--danger)' }}>Remove?</span>
              <button
                onClick={() => {
                  setContextMenu(null);
                  setConfirmRemoveProject(false);
                  onRemoveProject();
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
                onClick={() => setConfirmRemoveProject(false)}
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
              onClick={() => setConfirmRemoveProject(true)}
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
          )}
        </div>
      )}

      {expanded && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={() => { dragSlotRef.current = null; setDropSlot(null); }}
          style={{
            marginLeft: 14,
            borderLeft: '1px solid var(--border)',
            paddingLeft: 4,
            paddingRight: 2,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        >
          {slots.map((slot, slotIndex) => {
            if (slot.type === 'group') {
              const { group, sessions: groupSessions, color: gc } = slot;
              const isGroupActive = activeGroupId === group.id;
              const slotDropTarget = dropSlot?.slotIndex === slotIndex ? dropSlot.position : null;

              return (
                <div
                  key={`group-${group.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    dragSlotRef.current = slotIndex;
                  }}
                  onDragOver={(e) => handleSlotDragOver(e, slotIndex)}
                  onDrop={() => handleSlotDrop(slotIndex)}
                  style={{
                    border: `1px solid ${hexToRgba(gc, 0.3)}`,
                    boxShadow: `inset 0 0 0 1px ${hexToRgba(gc, 0.3)}`,
                    borderRadius: 6,
                    margin: '6px 4px',
                    padding: '0 0 2px',
                    overflow: 'hidden',
                    borderTop: slotDropTarget === 'above' ? `2px solid var(--text-secondary)` : undefined,
                    borderBottom: slotDropTarget === 'below' ? `2px solid var(--text-secondary)` : undefined,
                  }}
                >
                  {/* Group header — drag handle */}
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setGroupContextMenu({ x: e.clientX, y: e.clientY, groupId: group.id });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingGroupId(group.id);
                      setEditGroupValue(group.name);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSession(group.sessionIds[0]);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      cursor: 'grab',
                      background: hexToRgba(gc, 0.12),
                      borderBottom: `1px solid ${hexToRgba(gc, 0.15)}`,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: gc,
                      flexShrink: 0,
                    }} />
                    {editingGroupId === group.id ? (
                      <input
                        ref={groupInputRef}
                        value={editGroupValue}
                        onChange={(e) => setEditGroupValue(e.target.value)}
                        onBlur={() => {
                          const trimmed = editGroupValue.trim();
                          if (trimmed && trimmed !== group.name) onRenameGroup(group.id, trimmed);
                          setEditingGroupId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const trimmed = editGroupValue.trim();
                            if (trimmed && trimmed !== group.name) onRenameGroup(group.id, trimmed);
                            setEditingGroupId(null);
                          }
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        draggable={false}
                        style={{
                          fontSize: 10,
                          width: '100%',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          color: 'var(--text-primary)',
                          padding: '0 4px',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: isGroupActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {group.name}
                      </span>
                    )}
                  </div>
                  {groupSessions.map((gs) => (
                    <SessionItem
                      key={gs.id}
                      session={gs}
                      index={project.sessions.indexOf(gs)}
                      isActive={gs.id === activeSessionId || isGroupActive}
                      isSelected={selectedSessionIds.has(gs.id)}
                      onSelect={() => onSelectSession(gs.id)}
                      onRemove={() => onRemoveSession(gs.id)}
                      onRename={(name) => onRenameSession(gs.id, name)}
                      activity={sessionActivity[gs.id] || null}
                      serverUrl={sessionServerUrls[gs.id] || null}
                      disableDrag
                      onDragStart={() => { /* group handles drag */ }}
                      onDragOver={() => { /* group handles drag */ }}
                      onDrop={() => { /* group handles drag */ }}
                      dropTarget={null}
                      onToggleSelect={() => onToggleSelectSession(gs.id)}
                      onPrepareGrouping={() => {
                        if (!selectedSessionIds.has(gs.id)) onToggleSelectSession(gs.id);
                      }}
                      selectedCount={selectedProjectSessionIds.length}
                      groupActionLabel={groupActionLabel}
                      onGroupSelected={() => {
                        onGroupSessions(getGroupSessionIds(gs.id));
                      }}
                    />
                  ))}
                </div>
              );
            }

            // Single session slot
            const { session, sessionIndex } = slot;
            const slotDropTarget = dropSlot?.slotIndex === slotIndex ? dropSlot.position : null;
            return (
              <SessionItem
                key={session.id}
                session={session}
                index={sessionIndex}
                isActive={session.id === activeSessionId}
                isSelected={selectedSessionIds.has(session.id)}
                onSelect={() => onSelectSession(session.id)}
                onRemove={() => onRemoveSession(session.id)}
                onRename={(name) => onRenameSession(session.id, name)}
                activity={sessionActivity[session.id] || null}
                serverUrl={sessionServerUrls[session.id] || null}
                onDragStart={() => { dragSlotRef.current = slotIndex; }}
                onDragOver={(e) => handleSlotDragOver(e, slotIndex)}
                onDrop={() => handleSlotDrop(slotIndex)}
                dropTarget={slotDropTarget}
                onToggleSelect={() => onToggleSelectSession(session.id)}
                onPrepareGrouping={() => {
                  if (!selectedSessionIds.has(session.id)) onToggleSelectSession(session.id);
                }}
                selectedCount={selectedProjectSessionIds.length}
                groupActionLabel={groupActionLabel}
                onGroupSelected={() => {
                  onGroupSessions(getGroupSessionIds(session.id));
                }}
              />
            );
          })}
        </div>
      )}

      {/* Group context menu */}
      {groupContextMenu && (
        <div
          ref={groupMenuRef}
          style={{
            position: 'fixed',
            left: groupContextMenu.x,
            top: groupContextMenu.y,
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
            onClick={() => {
              const gid = groupContextMenu.groupId;
              setGroupContextMenu(null);
              const g = sessionGroups.find((sg) => sg.id === gid);
              if (g) {
                setEditingGroupId(gid);
                setEditGroupValue(g.name);
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
          >
            Rename
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button
            onClick={() => {
              const gid = groupContextMenu.groupId;
              const group = sessionGroups.find((sg) => sg.id === gid);
              if (group) {
                onSetGroupLayout(gid, getDefaultGroupLayout(group.sessionIds.length));
                onSelectSession(group.sessionIds[0]);
              }
              setGroupContextMenu(null);
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
            Split
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button
            onClick={() => { onUngroupSessions(groupContextMenu.groupId); setGroupContextMenu(null); }}
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
            Ungroup
          </button>
        </div>
      )}

    </div>
  );
}
