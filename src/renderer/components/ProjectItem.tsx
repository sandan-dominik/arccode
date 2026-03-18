import { useState, useRef, useEffect } from 'react';
import type { Project, Session, SessionGroup, SessionSplitGroup } from '../types';
import { SessionItem } from './SessionItem';

interface ProjectItemProps {
  project: Project;
  activeSessionId: string | null;
  activeSplitGroupId: string | null;
  onSelectSession: (sessionId: string) => void;
  onSelectSplitGroup: (groupId: string, splitGroupId: string) => void;
  onAddSession: () => void;
  onAddSessionToGroup: (groupId: string) => void;
  onRemoveSession: (sessionId: string) => void;
  onArchiveProject: () => void;
  onUnarchiveProject: () => void;
  onRemoveProject: () => void;
  onFocusProject: () => void;
  onExitFocusMode: () => void;
  isFocused: boolean;
  onRenameSession: (sessionId: string, name: string) => void;
  onReorderSessions: (projectId: string, fromIndex: number, toIndex: number) => void;
  onReorderGroupSessions: (projectId: string, sessionIds: string[], toIndex: number) => void;
  onReorderSessionWithinGroup: (projectId: string, groupId: string, fromSessionId: string, toSessionId: string, position: 'above' | 'below') => void;
  sessionActivity: Record<string, 'idle' | 'completed' | 'busy' | 'serving' | 'error'>;
  sessionServerUrls: Record<string, string>;
  selectedSessionIds: Set<string>;
  onToggleSelectSession: (sessionId: string) => void;
  sessionGroups: SessionGroup[];
  pendingRenameGroupId: string | null;
  onPendingRenameHandled: () => void;
  onGroupSessions: (sessionIds: string[]) => void;
  onUngroupSessions: (groupId: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onToggleGroupCollapsed: (groupId: string) => void;
  onCreateSplitGroup: (groupId: string, sessionIds: string[]) => void;
  onRemoveSplitGroup: (groupId: string, splitGroupId: string) => void;
  onAddSessionsToGroup: (groupId: string, sessionIds: string[]) => void;
  onRemoveSessionsFromGroups: (sessionIds: string[]) => void;
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
  activeSplitGroupId,
  onSelectSession,
  onSelectSplitGroup,
  onAddSession,
  onAddSessionToGroup,
  onRemoveSession,
  onArchiveProject,
  onUnarchiveProject,
  onRemoveProject,
  onFocusProject,
  onExitFocusMode,
  isFocused,
  onRenameSession,
  onReorderSessions,
  onReorderGroupSessions,
  onReorderSessionWithinGroup,
  sessionActivity,
  sessionServerUrls,
  selectedSessionIds,
  onToggleSelectSession,
  sessionGroups,
  pendingRenameGroupId,
  onPendingRenameHandled,
  onGroupSessions,
  onUngroupSessions,
  onRenameGroup,
  onToggleGroupCollapsed,
  onCreateSplitGroup,
  onRemoveSplitGroup,
  onAddSessionsToGroup,
  onRemoveSessionsFromGroups,
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
  const [splitGroupContextMenu, setSplitGroupContextMenu] = useState<{ x: number; y: number; groupId: string; splitGroupId: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const splitGroupMenuRef = useRef<HTMLDivElement>(null);

  const dragSlotRef = useRef<number | null>(null);
  const draggedSessionIdRef = useRef<string | null>(null);
  const draggedGroupedSessionRef = useRef<{ groupId: string; sessionId: string } | null>(null);
  const [dropSlot, setDropSlot] = useState<{ slotIndex: number; position: 'above' | 'below' | 'inside' } | null>(null);
  const [groupDropTarget, setGroupDropTarget] = useState<{ groupId: string; sessionId: string; position: 'above' | 'below' } | null>(null);

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

  useEffect(() => {
    if (editingGroupId && groupInputRef.current) {
      groupInputRef.current.focus();
      groupInputRef.current.select();
    }
  }, [editingGroupId]);

  useEffect(() => {
    if (!pendingRenameGroupId) return;
    const group = sessionGroups.find((entry) => entry.id === pendingRenameGroupId);
    if (!group) return;
    setEditingGroupId(group.id);
    setEditGroupValue(group.name);
    if (group.collapsed) {
      onToggleGroupCollapsed(group.id);
    }
    onPendingRenameHandled();
  }, [onPendingRenameHandled, onToggleGroupCollapsed, pendingRenameGroupId, sessionGroups]);

  useEffect(() => {
    if (!contextMenu && !groupContextMenu && !splitGroupContextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
      if (groupContextMenu && groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) setGroupContextMenu(null);
      if (splitGroupContextMenu && splitGroupMenuRef.current && !splitGroupMenuRef.current.contains(e.target as Node)) setSplitGroupContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu, groupContextMenu, splitGroupContextMenu]);

  const selectedProjectSessionIds = project.sessions
    .filter((session) => selectedSessionIds.has(session.id))
    .map((session) => session.id)
    .slice(0, 4);

  const getSessionGroup = (sessionId: string) => sessionGroups.find((group) => group.sessionIds.includes(sessionId)) || null;

  const getSelectionAction = (anchorSessionId: string) => {
    const sessionIds = [...new Set(selectedProjectSessionIds.includes(anchorSessionId)
      ? selectedProjectSessionIds
      : [anchorSessionId, ...selectedProjectSessionIds])].slice(0, 4);
    const groups = sessionIds.map((sessionId) => getSessionGroup(sessionId));
    const commonGroup = groups[0];
    const inSameGroup = sessionIds.length > 1 && commonGroup && groups.every((group) => group?.id === commonGroup.id);

    if (inSameGroup && commonGroup) {
      return {
        label: `Split ${sessionIds.length} Sessions`,
        action: () => onCreateSplitGroup(commonGroup.id, sessionIds),
      };
    }

    return {
      label: sessionIds.length <= 1 ? 'Create Group' : `Group ${sessionIds.length} Sessions`,
      action: () => onGroupSessions(sessionIds),
    };
  };

  const handleSlotDragOver = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    const fromSlot = dragSlotRef.current !== null ? slots[dragSlotRef.current] : null;
    const draggedSessionId = draggedSessionIdRef.current;
    const targetSlot = slots[slotIndex];

    if ((!fromSlot && !draggedSessionId) || (fromSlot && dragSlotRef.current === slotIndex)) {
      setDropSlot(null);
      return;
    }
    if ((fromSlot?.type === 'session' || draggedSessionId) && targetSlot?.type === 'group') {
      setDropSlot({ slotIndex, position: 'inside' });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    setDropSlot({ slotIndex, position });
  };

  const handleSlotDrop = (targetSlotIndex: number) => {
    const fromSlotIndex = dragSlotRef.current;
    const draggedSessionId = draggedSessionIdRef.current;
    const targetSlot = slots[targetSlotIndex];

    if (draggedSessionId && targetSlot?.type === 'group') {
      onAddSessionsToGroup(targetSlot.group.id, [draggedSessionId]);
      draggedSessionIdRef.current = null;
      draggedGroupedSessionRef.current = null;
      dragSlotRef.current = null;
      setDropSlot(null);
      return;
    }

    if (draggedSessionId && fromSlotIndex === null && targetSlot?.type === 'session') {
      const pos = dropSlot?.position || 'above';
      const fromIndex = project.sessions.findIndex((session) => session.id === draggedSessionId);
      if (fromIndex >= 0) {
        let toIndex = pos === 'below' ? targetSlot.sessionIndex + 1 : targetSlot.sessionIndex;
        if (fromIndex < toIndex) toIndex -= 1;
        onRemoveSessionsFromGroups([draggedSessionId]);
        if (fromIndex !== toIndex) onReorderSessions(project.id, fromIndex, toIndex);
      }
      draggedSessionIdRef.current = null;
      draggedGroupedSessionRef.current = null;
      dragSlotRef.current = null;
      setDropSlot(null);
      return;
    }

    if (fromSlotIndex === null || fromSlotIndex === targetSlotIndex) return;
    const fromSlot = slots[fromSlotIndex];
    const pos = dropSlot?.position || 'above';

    if (fromSlot.type === 'session' && targetSlot.type === 'group') {
      onAddSessionsToGroup(targetSlot.group.id, [fromSlot.session.id]);
      dragSlotRef.current = null;
      setDropSlot(null);
      return;
    }

    let targetSessionIndex: number;
    if (targetSlot.type === 'session') {
      targetSessionIndex = pos === 'below' ? targetSlot.sessionIndex + 1 : targetSlot.sessionIndex;
    } else if (pos === 'above') {
      targetSessionIndex = targetSlot.firstSessionIndex;
    } else {
      const maxIdx = Math.max(...targetSlot.group.sessionIds.map((id) => project.sessions.findIndex((s) => s.id === id)));
      targetSessionIndex = maxIdx + 1;
    }

    if (fromSlot.type === 'session') {
      const from = fromSlot.sessionIndex;
      let to = targetSessionIndex;
      if (from < to) to--;
      if (from !== to) onReorderSessions(project.id, from, to);
    } else {
      onReorderGroupSessions(project.id, fromSlot.group.sessionIds, targetSessionIndex);
    }

    dragSlotRef.current = null;
    draggedSessionIdRef.current = null;
    setDropSlot(null);
  };

  const renderSession = (session: Session, options?: { disableDrag?: boolean; isActive?: boolean; marginLeft?: number; groupedDrag?: boolean; groupId?: string }) => {
    const selectionAction = getSelectionAction(session.id);
    const groupedDropTarget = options?.groupId && groupDropTarget?.groupId === options.groupId && groupDropTarget.sessionId === session.id
      ? groupDropTarget.position
      : null;
    return (
      <div key={session.id} style={options?.marginLeft ? { marginLeft: options.marginLeft } : undefined}>
        <SessionItem
          session={session}
          index={project.sessions.indexOf(session)}
          isActive={options?.isActive ?? session.id === activeSessionId}
          isSelected={selectedSessionIds.has(session.id)}
          onSelect={() => onSelectSession(session.id)}
          onRemove={() => onRemoveSession(session.id)}
          onRename={(name) => onRenameSession(session.id, name)}
          activity={sessionActivity[session.id] || null}
          serverUrl={sessionServerUrls[session.id] || null}
          disableDrag={options?.disableDrag}
          onDragStart={() => {
            if (options?.groupedDrag) {
              draggedGroupedSessionRef.current = options.groupId ? { groupId: options.groupId, sessionId: session.id } : null;
              draggedSessionIdRef.current = session.id;
              dragSlotRef.current = null;
              return;
            }
            dragSlotRef.current = slots.findIndex((slot) => slot.type === 'session' && slot.session.id === session.id);
            draggedSessionIdRef.current = null;
            draggedGroupedSessionRef.current = null;
          }}
          onDragOver={(e) => {
            if (options?.groupedDrag) {
              const draggedGroupedSession = draggedGroupedSessionRef.current;
              if (!options.groupId || !draggedGroupedSession || draggedGroupedSession.groupId !== options.groupId || draggedGroupedSession.sessionId === session.id) {
                setGroupDropTarget(null);
                return;
              }

              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
              setGroupDropTarget({ groupId: options.groupId, sessionId: session.id, position });
              return;
            }
            const slotIndex = slots.findIndex((slot) => slot.type === 'session' && slot.session.id === session.id);
            if (slotIndex >= 0) handleSlotDragOver(e, slotIndex);
          }}
          onDrop={() => {
            if (options?.groupedDrag) {
              const draggedGroupedSession = draggedGroupedSessionRef.current;
              if (!options.groupId || !draggedGroupedSession || draggedGroupedSession.groupId !== options.groupId || draggedGroupedSession.sessionId === session.id || !groupedDropTarget) return;

              onReorderSessionWithinGroup(project.id, options.groupId, draggedGroupedSession.sessionId, session.id, groupedDropTarget);
              draggedGroupedSessionRef.current = null;
              setGroupDropTarget(null);
              return;
            }
            const slotIndex = slots.findIndex((slot) => slot.type === 'session' && slot.session.id === session.id);
            if (slotIndex >= 0) handleSlotDrop(slotIndex);
          }}
          dropTarget={groupedDropTarget}
          onToggleSelect={() => onToggleSelectSession(session.id)}
          onPrepareGrouping={() => {
            if (!selectedSessionIds.has(session.id)) onToggleSelectSession(session.id);
          }}
          selectedCount={selectedProjectSessionIds.length}
          groupActionLabel={selectionAction.label}
          onGroupSelected={selectionAction.action}
        />
      </div>
    );
  };

  const renderSplitGroup = (group: SessionGroup, splitGroup: SessionSplitGroup) => {
    const splitSessions = splitGroup.sessionIds
      .map((sessionId) => project.sessions.find((session) => session.id === sessionId))
      .filter(Boolean) as Session[];

    if (splitSessions.length < 2) return null;

    return (
      <div
        key={splitGroup.id}
        style={{
          margin: '4px 8px 6px',
          borderRadius: 6,
          border: `1px solid ${hexToRgba(group.color || '#ef4444', 0.2)}`,
          background: 'transparent',
          overflow: 'hidden',
        }}
      >
        <div
          onClick={() => onSelectSplitGroup(group.id, splitGroup.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSplitGroupContextMenu({ x: e.clientX, y: e.clientY, groupId: group.id, splitGroupId: splitGroup.id });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 10px',
            cursor: 'pointer',
            background: activeSplitGroupId === splitGroup.id ? hexToRgba(group.color || '#ef4444', 0.14) : 'transparent',
            borderBottom: `1px solid ${hexToRgba(group.color || '#ef4444', 0.16)}`,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{splitGroup.name}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{splitSessions.length} split</span>
        </div>
        <div style={{ padding: '4px 4px 4px 0' }}>
          {splitSessions.map((session) => renderSession(session, {
            disableDrag: true,
            isActive: activeSplitGroupId === splitGroup.id || session.id === activeSessionId,
            marginLeft: 4,
          }))}
        </div>
      </div>
    );
  };

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
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M2 4C2 3.44772 2.44772 3 3 3H6.5L8 5H13C13.5523 5 14 5.44772 14 6V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" stroke="var(--text-muted)" strokeWidth="1.2" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.name}
          </span>
          {isFocused && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--activity-serving)', textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 0 }}>Focus</span>}
          {project.isArchived && <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 0 }}>Archived</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {hovered && (
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <button onClick={(e) => { e.stopPropagation(); onAddSession(); }} title="New session" style={{ padding: '0 3px', color: 'var(--text-muted)', lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
                  <path d="M4.5 6.5L7 9L4.5 11.5" />
                  <path d="M8.5 11.5H11.5" />
                </svg>
              </button>
            </div>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease', flexShrink: 0 }}>
            <path d="M2 3L5 6L8 3" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {contextMenu && (
        <div ref={menuRef} style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 0', zIndex: 1000, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <button onClick={() => { setContextMenu(null); onAddSession(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>New Session</button>
          {!project.isArchived && <button onClick={() => { setContextMenu(null); isFocused ? onExitFocusMode() : onFocusProject(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{isFocused ? 'Exit Focus Mode' : 'Focus Mode'}</button>}
          <button onClick={() => { setContextMenu(null); project.isArchived ? onUnarchiveProject() : onArchiveProject(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>{project.isArchived ? 'Restore Project' : 'Archive Project'}</button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          {confirmRemoveProject ? (
            <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--danger)' }}>Remove completely?</span>
              <button onClick={() => { setContextMenu(null); setConfirmRemoveProject(false); onRemoveProject(); }} style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: 'var(--danger)', border: 'none', borderRadius: 3, padding: '2px 8px', cursor: 'pointer' }}>Yes</button>
              <button onClick={() => setConfirmRemoveProject(false)} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 8px', cursor: 'pointer' }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmRemoveProject(true)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--danger)' }}>Remove Completely</button>
          )}
        </div>
      )}

      {expanded && (
        <div onDragOver={(e) => e.preventDefault()} onDragEnd={() => { dragSlotRef.current = null; draggedSessionIdRef.current = null; draggedGroupedSessionRef.current = null; setDropSlot(null); setGroupDropTarget(null); }} style={{ marginLeft: 14, borderLeft: '1px solid var(--border)', paddingLeft: 4, paddingRight: 2, paddingTop: 6, paddingBottom: 6 }}>
          {slots.map((slot, slotIndex) => {
            if (slot.type === 'session') {
              const slotDropTarget = dropSlot?.slotIndex === slotIndex ? dropSlot.position : null;
              const selectionAction = getSelectionAction(slot.session.id);
              return (
                <SessionItem
                  key={slot.session.id}
                  session={slot.session}
                  index={slot.sessionIndex}
                  isActive={slot.session.id === activeSessionId}
                  isSelected={selectedSessionIds.has(slot.session.id)}
                  onSelect={() => onSelectSession(slot.session.id)}
                  onRemove={() => onRemoveSession(slot.session.id)}
                  onRename={(name) => onRenameSession(slot.session.id, name)}
                  activity={sessionActivity[slot.session.id] || null}
                  serverUrl={sessionServerUrls[slot.session.id] || null}
                  onDragStart={() => { dragSlotRef.current = slotIndex; }}
                  onDragOver={(e) => handleSlotDragOver(e, slotIndex)}
                  onDrop={() => handleSlotDrop(slotIndex)}
                  dropTarget={slotDropTarget}
                  onToggleSelect={() => onToggleSelectSession(slot.session.id)}
                  onPrepareGrouping={() => {
                    if (!selectedSessionIds.has(slot.session.id)) onToggleSelectSession(slot.session.id);
                  }}
                  selectedCount={selectedProjectSessionIds.length}
                  groupActionLabel={selectionAction.label}
                  onGroupSelected={selectionAction.action}
                />
              );
            }

            const group = slot.group;
            const groupSessions = slot.sessions;
            const slotDropTarget = dropSlot?.slotIndex === slotIndex ? dropSlot.position : null;
            const splitMembership = new Set((group.splitGroups || []).flatMap((splitGroup) => splitGroup.sessionIds));
            const standaloneSessions = groupSessions.filter((session) => !splitMembership.has(session.id));

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
                  border: `1px solid ${hexToRgba(slot.color, 0.3)}`,
                  boxShadow: `inset 0 0 0 1px ${hexToRgba(slot.color, 0.3)}`,
                  borderRadius: 6,
                  margin: '6px 4px',
                  padding: group.collapsed ? 0 : '0 0 2px',
                  overflow: 'hidden',
                  borderTop: slotDropTarget === 'above' ? '2px solid var(--text-secondary)' : undefined,
                  borderBottom: slotDropTarget === 'below' ? '2px solid var(--text-secondary)' : undefined,
                  background: slotDropTarget === 'inside' ? hexToRgba(slot.color, 0.08) : undefined,
                }}
              >
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
                    onToggleGroupCollapsed(group.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    cursor: 'pointer',
                    background: hexToRgba(slot.color, 0.12),
                    borderBottom: `1px solid ${hexToRgba(slot.color, 0.15)}`,
                  }}
                >
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
                      style={{ fontSize: 10, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', padding: '0 4px', outline: 'none' }}
                    />
                  ) : (
                    <>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddSessionToGroup(group.id);
                        }}
                        title="Add terminal to group"
                        style={{
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <span>{group.sessionIds.length}</span>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <rect x="1.75" y="2.75" width="12.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M4.5 6L6.5 8L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M8.5 10H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                      <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: group.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', flexShrink: 0, marginLeft: 6 }}>
                        <path d="M2 3L5 6L8 3" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    </>
                  )}
                </div>
                {!group.collapsed && (
                  <div style={{ padding: '4px 0' }}>
                    {(group.splitGroups || []).map((splitGroup) => renderSplitGroup(group, splitGroup))}
                    {standaloneSessions.map((session) => renderSession(session, { marginLeft: 4, groupedDrag: true, groupId: group.id }))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {groupContextMenu && (
        <div ref={groupMenuRef} style={{ position: 'fixed', left: groupContextMenu.x, top: groupContextMenu.y, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 0', zIndex: 1000, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <button onClick={() => {
            onAddSessionToGroup(groupContextMenu.groupId);
            setGroupContextMenu(null);
          }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>Add Terminal</button>
          <button onClick={() => {
            const group = sessionGroups.find((entry) => entry.id === groupContextMenu.groupId);
            setGroupContextMenu(null);
            if (group) {
              setEditingGroupId(group.id);
              setEditGroupValue(group.name);
            }
          }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>Rename</button>
          <button onClick={() => {
            onToggleGroupCollapsed(groupContextMenu.groupId);
            setGroupContextMenu(null);
          }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>
            {sessionGroups.find((entry) => entry.id === groupContextMenu.groupId)?.collapsed ? 'Expand Group' : 'Collapse Group'}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button onClick={() => { onUngroupSessions(groupContextMenu.groupId); setGroupContextMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--danger)' }}>Ungroup</button>
        </div>
      )}

      {splitGroupContextMenu && (
        <div ref={splitGroupMenuRef} style={{ position: 'fixed', left: splitGroupContextMenu.x, top: splitGroupContextMenu.y, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 0', zIndex: 1000, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <button onClick={() => {
            onSelectSplitGroup(splitGroupContextMenu.groupId, splitGroupContextMenu.splitGroupId);
            setSplitGroupContextMenu(null);
          }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)' }}>Open Split</button>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <button onClick={() => {
            onRemoveSplitGroup(splitGroupContextMenu.groupId, splitGroupContextMenu.splitGroupId);
            setSplitGroupContextMenu(null);
          }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--danger)' }}>Remove Split</button>
        </div>
      )}
    </div>
  );
}
