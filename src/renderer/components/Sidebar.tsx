import { useState, useEffect } from 'react';
import type { Project } from '../types';
import { ProjectItem } from './ProjectItem';

interface SidebarProps {
  projects: Project[];
  activeSessionId: string | null;
  onAddProject: () => void;
  onRemoveProject: (projectId: string) => void;
  onAddSession: (projectId: string) => void;
  onRemoveSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, name: string) => void;
  onReorderSessions: (projectId: string, fromIndex: number, toIndex: number) => void;
  sessionActivity: Record<string, 'idle' | 'completed' | 'busy' | 'serving' | 'error'>;
  sessionServerUrls: Record<string, string>;
  onOpenSettings: () => void;
}

export function Sidebar({
  projects,
  activeSessionId,
  onAddProject,
  onRemoveProject,
  onAddSession,
  onRemoveSession,
  onSelectSession,
  onRenameSession,
  onReorderSessions,
  sessionActivity,
  sessionServerUrls,
  onOpenSettings,
}: SidebarProps) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
    }}>
      {/* Logo */}
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

      {/* PROJECTS header */}
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
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
        {projects.length === 0 && (
          <button
            onClick={onAddProject}
            style={{
              margin: '12px 14px',
              padding: '24px 14px',
              border: '2px dashed var(--border)',
              borderRadius: 8,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              lineHeight: 1.5,
              width: 'calc(100% - 28px)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--text-muted)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            + Create project
          </button>
        )}
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
            onAddSession={() => onAddSession(project.id)}
            onRemoveSession={onRemoveSession}
            onRenameSession={onRenameSession}
            onReorderSessions={onReorderSessions}
            sessionActivity={sessionActivity}
            sessionServerUrls={sessionServerUrls}
            onRemoveProject={() => onRemoveProject(project.id)}
          />
        ))}
      </div>

      {/* Update + Settings buttons */}
      <div style={{
        padding: '8px 14px',
      }}>
        <UpdateButton />
      </div>
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
      // Only allow forward transitions: idle → downloading → ready. Don't regress.
      setStatus((prev) => {
        if (prev === 'ready') return prev;
        if (prev === 'downloading' && s !== 'ready') return prev;
        return s;
      });
    });
    // Check on mount
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
      {status === 'downloading' ? 'Downloading update...' : 'Update available — click to restart'}
    </button>
  );
}
