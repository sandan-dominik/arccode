import { useState, useEffect, useRef } from 'react';
import type { Project, SessionGroup } from '../types';
import { ProjectItem } from './ProjectItem';

interface SidebarProps {
  projects: Project[];
  focusedProjectId: string | null;
  activeSessionId: string | null;
  activeSplitGroupId: string | null;
  onAddProject: () => void;
  onRemoveProject: (projectId: string) => void;
  onArchiveProject: (projectId: string) => void;
  onUnarchiveProject: (projectId: string) => void;
  onFocusProject: (projectId: string | null) => void;
  onExitFocusMode: () => void;
  onReorderProjects: (fromIndex: number, toIndex: number) => void;
  onToggleProjectCollapsed: (projectId: string) => void;
  onAddSession: (projectId: string) => void;
  onAddSessionToGroup: (projectId: string, groupId: string) => void;
  onRemoveSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, name: string) => void;
  onReorderSessions: (projectId: string, fromIndex: number, toIndex: number) => void;
  onReorderGroupSessions: (projectId: string, sessionIds: string[], toIndex: number) => void;
  onReorderSessionWithinGroup: (projectId: string, groupId: string, fromSessionId: string, toSessionId: string, position: 'above' | 'below') => void;
  sessionActivity: Record<string, 'idle' | 'completed' | 'busy' | 'serving' | 'error'>;
  sessionServerUrls: Record<string, string>;
  onOpenSettings: () => void;
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
  onSelectSplitGroup: (groupId: string, splitGroupId: string) => void;
  onRemoveSplitGroup: (groupId: string, splitGroupId: string) => void;
  onAddSessionsToGroup: (groupId: string, sessionIds: string[]) => void;
  onRemoveSessionsFromGroups: (sessionIds: string[]) => void;
}

export function Sidebar({
  projects,
  focusedProjectId,
  activeSessionId,
  activeSplitGroupId,
  onAddProject,
  onRemoveProject,
  onArchiveProject,
  onUnarchiveProject,
  onFocusProject,
  onExitFocusMode,
  onReorderProjects,
  onToggleProjectCollapsed,
  onAddSession,
  onAddSessionToGroup,
  onRemoveSession,
  onSelectSession,
  onRenameSession,
  onReorderSessions,
  onReorderGroupSessions,
  onReorderSessionWithinGroup,
  sessionActivity,
  sessionServerUrls,
  onOpenSettings,
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
  onSelectSplitGroup,
  onRemoveSplitGroup,
  onAddSessionsToGroup,
  onRemoveSessionsFromGroups,
}: SidebarProps) {
  const dragProjectIndexRef = useRef<number | null>(null);
  const [dropProject, setDropProject] = useState<{ index: number; position: 'above' | 'below' } | null>(null);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const activeProjects = projects.filter((project) => !project.isArchived);
  const archivedProjects = projects.filter((project) => project.isArchived);
  const visibleProjects = focusedProjectId
    ? activeProjects.filter((project) => project.id === focusedProjectId)
    : activeProjects;

  const handleProjectDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragProjectIndexRef.current === null || dragProjectIndexRef.current === index) {
      setDropProject(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    setDropProject({ index, position });
  };

  const handleProjectDrop = (targetIndex: number) => {
    const fromIndex = dragProjectIndexRef.current;
    if (fromIndex === null || fromIndex === targetIndex) {
      dragProjectIndexRef.current = null;
      setDropProject(null);
      return;
    }
    let toIndex = targetIndex;
    if (dropProject?.position === 'below') {
      toIndex += 1;
    }
    if (fromIndex < toIndex) {
      toIndex -= 1;
    }
    if (fromIndex !== toIndex) {
      onReorderProjects(fromIndex, toIndex);
    }
    dragProjectIndexRef.current = null;
    setDropProject(null);
  };

  const renderProject = (project: Project) => {
    const projectIndex = projects.findIndex((entry) => entry.id === project.id);
    if (projectIndex === -1) return null;

    return (
      <ProjectItem
        key={project.id}
        project={project}
        activeSessionId={activeSessionId}
        activeSplitGroupId={activeSplitGroupId}
        onSelectSession={onSelectSession}
        onSelectSplitGroup={onSelectSplitGroup}
        onAddSession={() => onAddSession(project.id)}
        onAddSessionToGroup={(groupId) => onAddSessionToGroup(project.id, groupId)}
        onRemoveSession={onRemoveSession}
        onRenameSession={onRenameSession}
        onReorderSessions={onReorderSessions}
        onReorderGroupSessions={onReorderGroupSessions}
        onReorderSessionWithinGroup={onReorderSessionWithinGroup}
        onToggleProjectCollapsed={() => onToggleProjectCollapsed(project.id)}
        sessionActivity={sessionActivity}
        sessionServerUrls={sessionServerUrls}
        onArchiveProject={() => onArchiveProject(project.id)}
        onUnarchiveProject={() => onUnarchiveProject(project.id)}
        onRemoveProject={() => onRemoveProject(project.id)}
        onFocusProject={() => onFocusProject(project.id)}
        onExitFocusMode={onExitFocusMode}
        isFocused={focusedProjectId === project.id}
        selectedSessionIds={selectedSessionIds}
        onToggleSelectSession={onToggleSelectSession}
        sessionGroups={sessionGroups}
        pendingRenameGroupId={pendingRenameGroupId}
        onPendingRenameHandled={onPendingRenameHandled}
        onGroupSessions={onGroupSessions}
        onUngroupSessions={onUngroupSessions}
        onRenameGroup={onRenameGroup}
        onToggleGroupCollapsed={onToggleGroupCollapsed}
        onCreateSplitGroup={onCreateSplitGroup}
        onRemoveSplitGroup={onRemoveSplitGroup}
        onAddSessionsToGroup={onAddSessionsToGroup}
        onRemoveSessionsFromGroups={onRemoveSessionsFromGroups}
        dropTarget={dropProject?.index === projectIndex ? dropProject.position : null}
        onProjectDragStart={() => { dragProjectIndexRef.current = projectIndex; }}
        onProjectDragOver={(e) => handleProjectDragOver(e, projectIndex)}
        onProjectDrop={() => handleProjectDrop(projectIndex)}
        onProjectDragEnd={() => {
          dragProjectIndexRef.current = null;
          setDropProject(null);
        }}
      />
    );
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
    }}>
      <div style={{
        padding: '14px 14px 10px',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          ArcCode
        </span>
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          ALPHA | v{window.electronAPI.app.getVersion()}
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px 6px',
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
        }}>
          Projects
        </span>
        {!focusedProjectId && (
          <button
            onClick={onAddProject}
            title="Add project folder"
            style={{
              fontSize: 15,
              lineHeight: 1,
              color: 'var(--text-muted)',
              padding: 0,
            }}
          >
            +
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {activeProjects.length === 0 && (
          <button
            onClick={onAddProject}
            style={{
              margin: '12px 6px',
              padding: '24px 14px',
              border: '2px dashed var(--border)',
              borderRadius: 8,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              lineHeight: 1.5,
              width: 'calc(100% - 12px)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-muted)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            + Create project
          </button>
        )}
        {focusedProjectId && visibleProjects.length === 0 && activeProjects.length > 0 && (
          <div style={{ margin: '8px 6px', color: 'var(--text-muted)', fontSize: 12 }}>
            Focused project is unavailable.
          </div>
        )}
        {visibleProjects.map(renderProject)}
        {archivedProjects.length > 0 && !focusedProjectId && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setArchivedExpanded((prev) => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                color: 'var(--text-muted)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              <span>Archived</span>
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: archivedExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease', flexShrink: 0 }}>
                <path d="M2 3L5 6L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {archivedExpanded && archivedProjects.map(renderProject)}
          </div>
        )}
      </div>

      <div style={{
        padding: '8px 14px',
      }}>
        <UpdateButton />
      </div>
      {focusedProjectId && (
        <div style={{ padding: '0 14px 8px' }}>
          <button
            onClick={onExitFocusMode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              color: 'var(--text-secondary)',
              fontSize: 12,
              width: '100%',
            }}
          >
            Exit Focus Mode
          </button>
        </div>
      )}
      <div style={{
        padding: '0 14px 8px',
      }}>
        <button
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            color: 'var(--text-muted)',
            fontSize: 12,
            width: '100%',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="8" cy="8" r="5.5" />
            <circle cx="8" cy="8" r="2" />
            <path d="M8 2.5V1M8 15V13.5M13.5 8H15M1 8H2.5M12 4L13.2 2.8M2.8 13.2L4 12M12 12L13.2 13.2M2.8 2.8L4 4" strokeLinecap="round" />
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
}

function UpdateButton() {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'ready' | 'up-to-date' | 'error'>('idle');

  useEffect(() => {
    const removeListener = window.electronAPI.updater.onStatus((s) => {
      // Only allow forward transitions: idle -> downloading -> ready. Don't regress.
      setStatus((prev) => {
        if (prev === 'ready') return prev;
        if (prev === 'downloading' && s !== 'ready') return prev;
        return s;
      });
    });
    window.electronAPI.updater.check();
    return removeListener;
  }, []);

  if (status !== 'downloading' && status !== 'ready') return null;

  return (
    <button
      onClick={() => {
        if (status === 'ready') {
          window.electronAPI.updater.install();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        color: status === 'ready' ? 'var(--success)' : 'var(--text-muted)',
        fontSize: 12,
        width: '100%',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M8 2v9M5 8l3 3 3-3M3 13h10" />
      </svg>
      {status === 'downloading' ? 'Downloading update...' : 'Update available - click to restart'}
    </button>
  );
}
