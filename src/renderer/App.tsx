import { useCallback, useEffect, useRef, useState, createRef } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { TerminalArea } from './components/TerminalArea';
import { WindowTitleBar } from './components/WindowTitleBar';
import type { TerminalPaneHandle } from './components/TerminalPane';
import { Settings } from './components/Settings';
import { useStore } from './hooks/useStore';
import type { LayoutType, Project, Session } from '../shared/types';

function getDefaultGroupLayout(count: number): LayoutType {
  if (count >= 4) return 'grid';
  if (count === 3) return 'three';
  if (count === 2) return 'vsplit';
  return 'single';
}

function getGroupPaneStyle(layout: LayoutType, count: number, index: number): React.CSSProperties {
  if (count <= 1 || layout === 'single') {
    return { top: '0%', left: '0%', width: '100%', height: '100%' };
  }

  if (layout === 'grid' && count >= 4) {
    const row = Math.floor(index / 2);
    const col = index % 2;
    return {
      top: `${row * 50}%`,
      left: `${col * 50}%`,
      width: '50%',
      height: '50%',
    };
  }

  if (layout === 'three' && count >= 3) {
    if (index === 0) {
      return { top: '0%', left: '0%', width: '50%', height: '100%' };
    }
    return {
      top: `${(index - 1) * 50}%`,
      left: '50%',
      width: '50%',
      height: '50%',
    };
  }

  if (layout === 'hsplit') {
    return {
      top: `${(index * 100) / count}%`,
      left: '0%',
      width: '100%',
      height: `${100 / count}%`,
    };
  }

  return {
    top: '0%',
    left: `${(index * 100) / count}%`,
    width: `${100 / count}%`,
    height: '100%',
  };
}

function GroupPaneHeader({ sessionName, projectName, projectPath, serverUrl, activity }: {
  sessionName: string;
  projectName: string;
  projectPath: string;
  serverUrl: string | null;
  activity: string | null;
}) {
  const [branch, setBranch] = useState('');
  useEffect(() => {
    if (projectPath) {
      window.electronAPI.git.getBranch(projectPath).then(setBranch);
    }
  }, [projectPath]);

  const activityColor = activity === 'busy' ? 'var(--activity-busy)'
    : activity === 'serving' ? 'var(--activity-serving)'
    : activity === 'completed' ? 'var(--success)'
    : activity === 'error' ? 'var(--danger)'
    : 'var(--text-muted)';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 28,
      padding: '0 10px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      minWidth: 0,
    }}>
      {activity && (
        <span style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: activityColor,
          flexShrink: 0,
          animation: activity === 'busy' ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }} />
      )}
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sessionName}
      </span>
      {projectName && (
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          padding: '1px 6px',
          borderRadius: 3,
          background: 'var(--badge-bg)',
          color: 'var(--badge-text)',
          flexShrink: 0,
        }}>
          {projectName}
        </span>
      )}
      {branch && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z" />
          </svg>
          {branch}
        </span>
      )}
      {serverUrl && (
        <span
          onClick={() => window.electronAPI.shell.openExternal(serverUrl)}
          style={{ fontSize: 10, color: 'var(--activity-serving)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}
          title={`Open ${serverUrl} in browser`}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M1.5 8h13M8 1.5c-2 2.5-2 9.5 0 13M8 1.5c2 2.5 2 9.5 0 13" />
          </svg>
          {serverUrl.replace(/^https?:\/\//, '')}
        </span>
      )}
    </div>
  );
}

export function App() {
  // Blur any auto-focused element on mount
  useEffect(() => { (document.activeElement as HTMLElement)?.blur(); }, []);

  const store = useStore();
  const inputBufferRef = useRef<Record<string, string>>({});
  const [showSettings, setShowSettings] = useState(false);
  type ActivityState = 'idle' | 'completed' | 'busy' | 'serving' | 'error';
  type RuntimeActivityState = 'idle' | 'busy' | 'serving' | 'error';
  const [sessionActivity, setSessionActivity] = useState<Record<string, ActivityState>>({});
  const activityTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const completedDecayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const runtimeActivityRef = useRef<Record<string, RuntimeActivityState>>({});
  const staleBusySinceRef = useRef<Record<string, number>>({});
  const busySinceRef = useRef<Record<string, number>>({});
  const interactiveRef = useRef<Record<string, boolean>>({});
  const [sessionServerUrls, setSessionServerUrls] = useState<Record<string, string>>({});
  const serverUrlFoundRef = useRef<Record<string, boolean>>({});
  const chimeSuppressUntilRef = useRef<Record<string, number>>({});
  const terminalRefs = useRef<Record<string, React.RefObject<TerminalPaneHandle | null>>>({});
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [activeSplitGroupId, setActiveSplitGroupId] = useState<string | null>(null);
  const [projectSwitcherVisible, setProjectSwitcherVisible] = useState(false);
  const [projectSwitcherProjectId, setProjectSwitcherProjectId] = useState<string | null>(null);
  const [pendingRenameGroupId, setPendingRenameGroupId] = useState<string | null>(null);

  // How long after last PTY output before we consider a command "done"
  const OUTPUT_GAP_MS = 2000;
  // How long a stale busy session stays green before fading to idle
  const COMPLETED_DECAY_MS = 60_000;
  // Minimum busy duration before playing completion chime
  const CHIME_MIN_BUSY_MS = 5000;

  const deriveActivity = useCallback((sessionId: string): ActivityState => {
    const runtimeState = runtimeActivityRef.current[sessionId] || 'idle';
    if (runtimeState === 'idle' || runtimeState === 'serving' || runtimeState === 'error') {
      return runtimeState;
    }

    const staleSince = staleBusySinceRef.current[sessionId];
    if (!staleSince) {
      return 'busy';
    }

    return Date.now() - staleSince < COMPLETED_DECAY_MS ? 'completed' : 'idle';
  }, []);

  const syncActivity = useCallback((sessionId: string) => {
    const nextState = deriveActivity(sessionId);
    setSessionActivity((prev) => (
      prev[sessionId] === nextState ? prev : { ...prev, [sessionId]: nextState }
    ));
  }, [deriveActivity]);

  const clearCompletedDecayTimer = useCallback((sessionId: string) => {
    clearTimeout(completedDecayTimers.current[sessionId]);
    delete completedDecayTimers.current[sessionId];
  }, []);

  const scheduleCompletedDecay = useCallback((sessionId: string, staleSince: number) => {
    clearCompletedDecayTimer(sessionId);
    const remainingMs = Math.max(COMPLETED_DECAY_MS - (Date.now() - staleSince), 0);
    completedDecayTimers.current[sessionId] = setTimeout(() => {
      delete completedDecayTimers.current[sessionId];
      syncActivity(sessionId);
    }, remainingMs);
  }, [clearCompletedDecayTimer, syncActivity]);

  const setRuntimeActivity = useCallback((sessionId: string, state: RuntimeActivityState) => {
    runtimeActivityRef.current[sessionId] = state;
    if (state !== 'busy') {
      delete staleBusySinceRef.current[sessionId];
      clearCompletedDecayTimer(sessionId);
    }
    syncActivity(sessionId);
  }, [clearCompletedDecayTimer, syncActivity]);

  const markBusyStale = useCallback((sessionId: string) => {
    const staleSince = Date.now();
    staleBusySinceRef.current[sessionId] = staleSince;
    syncActivity(sessionId);
    scheduleCompletedDecay(sessionId, staleSince);
  }, [scheduleCompletedDecay, syncActivity]);

  // Initialize opened sessions to 'idle'
  useEffect(() => {
    for (const id of store.openedSessionIds) {
      if (!runtimeActivityRef.current[id]) {
        runtimeActivityRef.current[id] = 'idle';
        setSessionActivity((prev) => ({ ...prev, [id]: 'idle' }));
      }
    }
  }, [store.openedSessionIds]);

  // Suppress chime briefly on tab switch (resize causes PTY redraw)
  const prevActiveSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (store.activeSessionId && store.activeSessionId !== prevActiveSessionRef.current) {
      const until = Date.now() + 3000;
      chimeSuppressUntilRef.current[store.activeSessionId] = until;
      if (prevActiveSessionRef.current) {
        chimeSuppressUntilRef.current[prevActiveSessionRef.current] = until;
      }

    }
    prevActiveSessionRef.current = store.activeSessionId;
  }, [store.activeSessionId]);

  useEffect(() => () => {
    Object.values(activityTimers.current).forEach(clearTimeout);
    Object.values(completedDecayTimers.current).forEach(clearTimeout);
  }, []);

  const playDoneSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(880, 0, 0.15);
      playTone(1320, 0.12, 0.18);
    } catch {
      // Audio not available
    }
  }, []);

  // Detect crash/error patterns in PTY output (case-insensitive, stripped of ANSI codes)
  const SERVER_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/[^\s]*)?/i;
  // const ERROR_RE = /\bERROR\b|npm ERR!/;
  const errorDetectedRef = useRef<Record<string, boolean>>({});
  const ansiEscapeRe = useRef(new RegExp(`${String.fromCharCode(27)}(?:\\[[0-9;?]*[ -/]*[@-~]|[@-Z\\\\-_])`, 'g'));
  const ptyOutputBufferRef = useRef<Record<string, string>>({});

  // ── PTY output handler ──
  // Strategy: every output chunk resets a 2s debounce timer.
  // When no output arrives for 2s → busy transitions to completed (or error if errors were seen).
  // completed/error does NOT transition back to busy on output — only on explicit user action.
  const handlePtyOutput = useCallback((sessionId: string, data: string) => {
    const currentState = runtimeActivityRef.current[sessionId];
    if (!currentState) return;

    const plain = data.replace(ansiEscapeRe.current, '');
    const buffered = `${ptyOutputBufferRef.current[sessionId] || ''}${plain}`.slice(-4096);
    ptyOutputBufferRef.current[sessionId] = buffered;

    // Capture server URL from output only when already in serving mode (triggered by command detection)
    if (currentState === 'serving' && !serverUrlFoundRef.current[sessionId]) {
      const match = buffered.match(SERVER_URL_RE);
      if (match) {
        const url = match[0].replace('0.0.0.0', 'localhost');
        serverUrlFoundRef.current[sessionId] = true;
        setSessionServerUrls((prev) => ({ ...prev, [sessionId]: url }));
      }
    }

    // Only track output for sessions with a potentially active foreground command.
    if (currentState !== 'busy') return;

    if (staleBusySinceRef.current[sessionId]) {
      delete staleBusySinceRef.current[sessionId];
      clearCompletedDecayTimer(sessionId);
      syncActivity(sessionId);
    }

    // Temporarily disable error-state detection. Dev servers can emit transient
    // errors while still running, which leaves the session stuck in error.
    // if (!errorDetectedRef.current[sessionId]) {
    //   // eslint-disable-next-line no-control-regex
    //   const plain = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    //   if (ERROR_RE.test(plain)) {
    //     errorDetectedRef.current[sessionId] = true;
    //   }
    // }

    // Reset the "output gap" timer — command is still producing output
    clearTimeout(activityTimers.current[sessionId]);
    // Interactive tools (e.g. claude) have long pauses — use longer timeout
    const gapMs = interactiveRef.current[sessionId] ? 30_000 : OUTPUT_GAP_MS;
    activityTimers.current[sessionId] = setTimeout(() => {
      delete activityTimers.current[sessionId];
      if (runtimeActivityRef.current[sessionId] !== 'busy') return;

      // const hadError = errorDetectedRef.current[sessionId];
      const busyDuration = Date.now() - (busySinceRef.current[sessionId] || 0);
      markBusyStale(sessionId);

      // Play chime if command ran long enough and chimes aren't suppressed
      const chimesSuppressed = Date.now() < (chimeSuppressUntilRef.current[sessionId] || 0);
      if (busyDuration > CHIME_MIN_BUSY_MS && !chimesSuppressed) {
        playDoneSound();
      }

    }, gapMs);
  }, [clearCompletedDecayTimer, markBusyStale, playDoneSound, syncActivity]);

  const servingCommandSet = new Set(store.servingCommands.map((command) => command.trim().toLowerCase()));
  const isServingCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    if (!trimmed) return false;
    if (servingCommandSet.has(trimmed)) return true;
    if (/electron-forge\s+start|convex\s+dev/.test(trimmed)) return true;
    return /(?:npm|yarn|pnpm|bun)\s+(?:run\s+)?[\w:-]*:?listen[\w:-]*(?:\s|$)/.test(trimmed);
  }, [servingCommandSet]);
  // Commands that are long-running interactive tools (not servers, but shouldn't trigger idle on output gaps)
  const INTERACTIVE_CMD_RE = /\bclaude\b|\bcodex\b/;

  // ── Transition to busy ──
  // Called when the user explicitly starts a command (Enter key or button click).
  const markBusy = useCallback((sessionId: string) => {
    clearTimeout(activityTimers.current[sessionId]);
    delete activityTimers.current[sessionId];
    clearCompletedDecayTimer(sessionId);
    errorDetectedRef.current[sessionId] = false;
    interactiveRef.current[sessionId] = false;
    delete staleBusySinceRef.current[sessionId];
    busySinceRef.current[sessionId] = Date.now();
    setRuntimeActivity(sessionId, 'busy');
  }, [clearCompletedDecayTimer, setRuntimeActivity]);

  const clearServerActivity = useCallback((sessionId: string) => {
    serverUrlFoundRef.current[sessionId] = false;
    ptyOutputBufferRef.current[sessionId] = '';
    setSessionServerUrls((prev) => {
      if (!(sessionId in prev)) return prev;
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  }, []);

  const markServing = useCallback((sessionId: string) => {
    clearTimeout(activityTimers.current[sessionId]);
    delete activityTimers.current[sessionId];
    clearServerActivity(sessionId);
    setRuntimeActivity(sessionId, 'serving');
  }, [clearServerActivity, setRuntimeActivity]);

  const beginCommandTracking = useCallback((sessionId: string, cmd: string, forceServing = false) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    if (forceServing || isServingCommand(trimmed)) {
      markServing(sessionId);
      return;
    }

    markBusy(sessionId);
    if (INTERACTIVE_CMD_RE.test(trimmed)) {
      interactiveRef.current[sessionId] = true;
    }
  }, [isServingCommand, markBusy, markServing]);

  const handleRunScript = useCallback((sessionId: string, scriptName: string, cmd: string) => {
    beginCommandTracking(sessionId, cmd);
    const ref = terminalRefs.current[sessionId];
    if (ref?.current) {
      ref.current.focus();
      setTimeout(() => ref.current?.write(cmd), 50);
    }
  }, [beginCommandTracking]);

  const runCommandInSession = useCallback((sessionId: string, cmd: string) => {
    beginCommandTracking(sessionId, cmd);
    const ref = terminalRefs.current[sessionId];
    if (ref?.current) {
      ref.current.focus();
      setTimeout(() => ref.current?.write(cmd), 50);
    }
  }, [beginCommandTracking]);

  const sessionProjectMap = new Map<string, { session: Session; projectPath: string }>();
  for (const project of store.projects) {
    for (const session of project.sessions) {
      if (store.openedSessionIds.has(session.id)) {
        sessionProjectMap.set(session.id, { session, projectPath: project.path });
      }
    }
  }

  const focusModeProjects = store.projects.filter((project) => !project.isArchived);

  const applyFocusedProject = useCallback((projectId: string) => {
    const project = store.projects.find((entry) => entry.id === projectId);
    if (!project) return;

    store.setFocusedProjectId(projectId);
    setActiveSplitGroupId(null);
    setSelectedSessionIds(new Set());
    setShowSettings(false);

    const recentSession = Array.from(store.openedSessionIds)
      .reverse()
      .map((sessionId) => project.sessions.find((session) => session.id === sessionId) || null)
      .find((session): session is Session => session !== null);
    const nextSession = recentSession || project.sessions[0] || null;
    if (nextSession) {
      store.selectSession(nextSession.id);
    }
  }, [store]);

  useEffect(() => {
    if (!store.focusedProjectId || focusModeProjects.length < 2) {
      if (projectSwitcherVisible) setProjectSwitcherVisible(false);
      if (projectSwitcherProjectId) setProjectSwitcherProjectId(null);
      return;
    }

    const cycleProjects = (direction: 1 | -1) => {
      const currentId = projectSwitcherVisible && projectSwitcherProjectId
        ? projectSwitcherProjectId
        : store.focusedProjectId;
      const currentIndex = Math.max(0, focusModeProjects.findIndex((project) => project.id === currentId));
      const nextIndex = (currentIndex + direction + focusModeProjects.length) % focusModeProjects.length;
      setProjectSwitcherProjectId(focusModeProjects[nextIndex]?.id || null);
      setProjectSwitcherVisible(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.key === 'Tab')) return;
      event.preventDefault();
      cycleProjects(event.shiftKey ? -1 : 1);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Control') return;
      if (projectSwitcherVisible && projectSwitcherProjectId) {
        applyFocusedProject(projectSwitcherProjectId);
      }
      setProjectSwitcherVisible(false);
      setProjectSwitcherProjectId(null);
    };

    const handleBlur = () => {
      setProjectSwitcherVisible(false);
      setProjectSwitcherProjectId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [applyFocusedProject, focusModeProjects, projectSwitcherProjectId, projectSwitcherVisible, store.focusedProjectId]);

  const handleTerminalData = useCallback((sessionId: string, data: string) => {
    // Ctrl+C clears interactive flag so output gap detection resumes
    if (data === '\x03') {
      interactiveRef.current[sessionId] = false;
    }
    // Ctrl+C while serving → exit serving mode, go to busy (will settle to completed via output gap)
    if (data === '\x03' && runtimeActivityRef.current[sessionId] === 'serving') {
      markBusy(sessionId);
      clearServerActivity(sessionId);
    }

    if (data === '\r') {
      const cmd = (inputBufferRef.current[sessionId] || '').trim();
      if (cmd) {
        store.updateSessionLastCommand(sessionId, cmd);
        // Detect server-like commands → serving mode immediately
        if (isServingCommand(cmd)) {
          markServing(sessionId);
        } else {
          // Any command → busy (works from idle, completed, or already busy)
          markBusy(sessionId);
          // Flag interactive CLI tools so output gaps don't trigger completion
          if (INTERACTIVE_CMD_RE.test(cmd)) {
            interactiveRef.current[sessionId] = true;
          }
        }
      }
      inputBufferRef.current[sessionId] = '';
    } else if (data === '\x7f') {
      inputBufferRef.current[sessionId] = (inputBufferRef.current[sessionId] || '').slice(0, -1);
    } else if (data.length === 1 && data >= ' ') {
      inputBufferRef.current[sessionId] = (inputBufferRef.current[sessionId] || '') + data;
    }
  }, [clearServerActivity, isServingCommand, markBusy, markServing, store.updateSessionLastCommand]);

  const handleToggleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);

  const handleGroupSessions = useCallback((sessionIds: string[]) => {
    const groupId = store.addSessionGroup(sessionIds);
    if (!groupId) return;
    setSelectedSessionIds(new Set());
    setPendingRenameGroupId(groupId);
    for (const id of sessionIds) {
      store.selectSession(id);
    }
  }, [store.addSessionGroup, store.selectSession]);

  const handleUngroupSessions = useCallback((groupId: string) => {
    store.removeSessionGroup(groupId);
    const activeSplitOwner = store.sessionGroups.find((group) => (group.splitGroups || []).some((splitGroup) => splitGroup.id === activeSplitGroupId));
    if (activeSplitOwner?.id === groupId) setActiveSplitGroupId(null);
  }, [store.removeSessionGroup, store.sessionGroups, activeSplitGroupId]);

  const handleCreateSplitGroup = useCallback((groupId: string, sessionIds: string[]) => {
    const splitGroupId = store.createSessionSplitGroup(groupId, sessionIds);
    if (!splitGroupId) return;
    setSelectedSessionIds(new Set());
    for (const id of sessionIds) {
      store.selectSession(id);
    }
    setActiveSplitGroupId(splitGroupId);
  }, [store.createSessionSplitGroup, store.selectSession]);

  useEffect(() => {
    const handleShortcutKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'g' && key !== 's') return;

      const selectedIds = Array.from(selectedSessionIds).slice(0, 4);
      if (selectedIds.length < 2) return;

      if (key === 'g') {
        event.preventDefault();
        handleGroupSessions(selectedIds);
        return;
      }

      const groups = selectedIds
        .map((sessionId) => store.sessionGroups.find((group) => group.sessionIds.includes(sessionId)) || null);
      const commonGroup = groups[0];
      const inSameGroup = !!commonGroup && groups.every((group) => group?.id === commonGroup.id);
      if (!inSameGroup || !commonGroup) return;

      event.preventDefault();
      handleCreateSplitGroup(commonGroup.id, selectedIds);
    };

    window.addEventListener('keydown', handleShortcutKeyDown);
    return () => window.removeEventListener('keydown', handleShortcutKeyDown);
  }, [handleCreateSplitGroup, handleGroupSessions, selectedSessionIds, store.sessionGroups]);

  const handleSelectSplitGroup = useCallback((groupId: string, splitGroupId: string) => {
    setShowSettings(false);
    const group = store.sessionGroups.find((entry) => entry.id === groupId);
    const splitGroup = group?.splitGroups?.find((entry) => entry.id === splitGroupId);
    if (!group || !splitGroup) return;
    setSelectedSessionIds(new Set());
    for (const id of splitGroup.sessionIds) {
      store.selectSession(id);
    }
    setActiveSplitGroupId(splitGroupId);
  }, [store.selectSession, store.sessionGroups]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setShowSettings(false);
    store.selectSession(sessionId);
    setSelectedSessionIds(new Set());
    setActiveSplitGroupId(null);
  }, [store.selectSession]);

  const activeSplitGroupEntry = store.sessionGroups
    .flatMap((group) => (group.splitGroups || []).map((splitGroup) => ({ group, splitGroup })))
    .find(({ splitGroup }) => splitGroup.id === activeSplitGroupId) || null;
  const activeSplitGroup = activeSplitGroupEntry?.splitGroup || null;
  const activeSplitOwner = activeSplitGroupEntry?.group || null;
  const activeSplitLayout = activeSplitGroup?.layout || getDefaultGroupLayout(activeSplitGroup?.sessionIds.length || 0);
  const activeSplitSessionIds = activeSplitGroup
    ? activeSplitGroup.sessionIds.filter((sessionId) => sessionProjectMap.has(sessionId))
    : [];
  const activeSplitSessions = activeSplitSessionIds
    .map((sessionId) => {
      const project = store.projects.find((p) => p.sessions.some((s) => s.id === sessionId)) || null;
      const session = project?.sessions.find((s) => s.id === sessionId) || null;
      if (!project || !session) return null;
      return { sessionId, project, session };
    })
    .filter(Boolean) as Array<{ sessionId: string; project: Project; session: Session }>;
  const activeSplitIndexBySessionId = new Map(activeSplitSessionIds.map((sessionId, index) => [sessionId, index]));

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <WindowTitleBar />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <Allotment
        proportionalLayout={false}
        onChange={(sizes) => {
          const nextSidebarWidth = sizes[0];
          if (typeof nextSidebarWidth === 'number' && Number.isFinite(nextSidebarWidth) && nextSidebarWidth > 0) {
            store.setSidebarWidth(Math.round(nextSidebarWidth));
          }
        }}
      >
        <Allotment.Pane preferredSize={store.sidebarWidth} minSize={160} maxSize={360}>
          <Sidebar
            projects={store.projects}
            focusedProjectId={store.focusedProjectId}
            activeSessionId={store.activeSessionId}
            activeSplitGroupId={activeSplitGroupId}
            onAddProject={store.addProject}
            onRemoveProject={store.removeProject}
            onArchiveProject={store.archiveProject}
            onUnarchiveProject={store.unarchiveProject}
            onFocusProject={store.setFocusedProjectId}
            onExitFocusMode={() => store.setFocusedProjectId(null)}
            onReorderProjects={store.reorderProjects}
            onAddSession={store.addSession}
            onAddSessionToGroup={store.addSessionToGroup}
            onRemoveSession={store.removeSession}
            onSelectSession={handleSelectSession}
            onRenameSession={store.renameSession}
            onReorderSessions={store.reorderSessions}
            onReorderGroupSessions={store.reorderGroupSessions}
            onReorderSessionWithinGroup={store.reorderSessionWithinGroup}
            sessionActivity={sessionActivity}
            sessionServerUrls={sessionServerUrls}
            onOpenSettings={() => setShowSettings(true)}
            selectedSessionIds={selectedSessionIds}
            onToggleSelectSession={handleToggleSelectSession}
            sessionGroups={store.sessionGroups}
            pendingRenameGroupId={pendingRenameGroupId}
            onPendingRenameHandled={() => setPendingRenameGroupId(null)}
            onGroupSessions={handleGroupSessions}
            onUngroupSessions={handleUngroupSessions}
            onRenameGroup={store.renameSessionGroup}
            onToggleGroupCollapsed={store.toggleSessionGroupCollapsed}
            onCreateSplitGroup={handleCreateSplitGroup}
            onSelectSplitGroup={handleSelectSplitGroup}
            onRemoveSplitGroup={store.removeSessionSplitGroup}
            onAddSessionsToGroup={store.addSessionsToGroup}
            onRemoveSessionsFromGroups={store.removeSessionsFromGroups}
          />
        </Allotment.Pane>
        <Allotment.Pane>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {showSettings && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
              <Settings
                theme={store.theme}
                onThemeChange={store.setTheme}
                terminalBgColor={store.terminalBgColor}
                onTerminalBgColorChange={store.setTerminalBgColor}
                shellPath={store.shellPath}
                shellArgs={store.shellArgs}
                onShellConfigChange={store.setShellConfig}
                claudeDefault={store.claudeDefault}
                onClaudeDefaultChange={store.setClaudeDefault}
                openDefault={store.openDefault}
                onOpenDefaultChange={store.setOpenDefault}
                autoCopy={store.autoCopy}
                onAutoCopyChange={store.setAutoCopy}
                rightClickPaste={store.rightClickPaste}
                onRightClickPasteChange={store.setRightClickPaste}
                servingCommands={store.servingCommands}
                onServingCommandsChange={store.setServingCommands}
                onClose={() => setShowSettings(false)}
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', visibility: showSettings ? 'hidden' : 'visible' }}>
              {activeSplitGroup && activeSplitOwner ? (
                <HeaderBar
                  projectName={null}
                  projectPath={store.activeProject?.path || null}
                  sessionName={activeSplitGroup.name}
                  onRenameSession={(name: string) => store.renameSessionSplitGroup(activeSplitOwner.id, activeSplitGroup.id, name)}
                  claudeDefault={store.claudeDefault}
                  openDefault={store.openDefault}
                  serverUrl={store.activeSessionId ? sessionServerUrls[store.activeSessionId] || null : null}
                  onRunCommand={store.activeSessionId
                    ? (cmd: string) => runCommandInSession(store.activeSessionId!, cmd)
                    : null
                  }
                  onRunScript={store.activeSessionId
                    ? (scriptName: string, cmd: string) => handleRunScript(store.activeSessionId!, scriptName, cmd)
                    : null
                  }
                  groupColor={activeSplitOwner.color || null}
                  onGroupColorChange={(color: string) => store.updateGroupColor(activeSplitOwner.id, color)}
                />
              ) : store.activeSessionId ? (
                <HeaderBar
                  projectName={store.activeProject?.name || null}
                  projectPath={store.activeProject?.path || null}
                  sessionName={store.activeSession?.name || null}
                  onRenameSession={store.activeSession
                    ? (name: string) => store.renameSession(store.activeSession!.id, name)
                    : null
                  }
                  claudeDefault={store.claudeDefault}
                  openDefault={store.openDefault}
                  serverUrl={store.activeSessionId ? sessionServerUrls[store.activeSessionId] || null : null}
                  onRunCommand={store.activeSessionId
                    ? (cmd: string) => runCommandInSession(store.activeSessionId!, cmd)
                    : null
                  }
                  onRunScript={store.activeSessionId
                    ? (scriptName: string, cmd: string) => handleRunScript(store.activeSessionId!, scriptName, cmd)
                    : null
                  }
                />
              ) : null}
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {[...sessionProjectMap.entries()].map(([sessionId, { session, projectPath }]) => {
                  const splitIndex = activeSplitGroup ? activeSplitIndexBySessionId.get(sessionId) : undefined;
                  const isInActiveSplit = splitIndex != null;
                  const isVisible = !showSettings && (isInActiveSplit || sessionId === store.activeSessionId);
                  const splitSession = isInActiveSplit
                    ? activeSplitSessions[splitIndex]
                    : null;
                  const paneStyle = isInActiveSplit
                    ? getGroupPaneStyle(activeSplitLayout, activeSplitSessions.length, splitIndex)
                    : { top: '0%', left: '0%', width: '100%', height: '100%' };

                  return (
                    <div
                      key={sessionId}
                      onMouseDown={isInActiveSplit ? () => {
                        if (store.activeSessionId !== sessionId) {
                          store.selectSession(sessionId);
                        }
                      } : undefined}
                      style={{
                        position: 'absolute',
                        ...paneStyle,
                        display: 'flex',
                        flexDirection: 'column',
                        visibility: isVisible ? 'visible' : 'hidden',
                        pointerEvents: isVisible ? 'auto' : 'none',
                        borderRight: isInActiveSplit && activeSplitLayout !== 'grid' && splitIndex < activeSplitSessions.length - 1
                          ? '1px solid var(--border)'
                          : undefined,
                        borderBottom: isInActiveSplit && activeSplitLayout === 'grid' && splitIndex < 2
                          ? '1px solid var(--border)'
                          : undefined,
                      }}
                    >
                      {splitSession && (
                        <GroupPaneHeader
                          sessionName={splitSession.session.name}
                          projectName={splitSession.project.name}
                          projectPath={splitSession.project.path}
                          serverUrl={sessionServerUrls[sessionId] || null}
                          activity={sessionActivity[sessionId] || null}
                        />
                      )}
                      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                        <TerminalArea
                          ref={(() => {
                            if (!terminalRefs.current[sessionId]) {
                              terminalRefs.current[sessionId] = createRef();
                            }
                            return terminalRefs.current[sessionId];
                          })()}
                          sessionId={sessionId}
                          layout={session.layout}
                          cwd={projectPath}
                          onTerminalData={(data) => handleTerminalData(sessionId, data)}
                          onPtyOutput={(data) => handlePtyOutput(sessionId, data)}
                          bgColor={store.terminalBgColor}
                          isActive={isInActiveSplit || sessionId === store.activeSessionId}
                          shellPath={store.shellPath}
                          shellArgs={store.shellArgs}
                          autoCopy={store.autoCopy}
                          rightClickPaste={store.rightClickPaste}
                        />
                      </div>
                    </div>
                  );
                })}

                {!store.activeSessionId && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: 20,
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                        ArcCode
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        v{window.electronAPI.app.getVersion()}
                      </div>
                    </div>
                    {(() => {
                      if (store.projects.length === 0) return (
                        <button
                          onClick={store.addProject}
                          style={{
                            padding: '32px 48px',
                            border: '2px dashed var(--border)',
                            borderRadius: 10,
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            fontSize: 14,
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
                      );
                      const sessionLookup = new Map<string, { sessionName: string; projectName: string }>();
                      for (const project of store.projects) {
                        for (const session of project.sessions) {
                          sessionLookup.set(session.id, { sessionName: session.name, projectName: project.name });
                        }
                      }
                      const recentSessions = Array.from(store.openedSessionIds)
                        .reverse()
                        .map((sessionId) => {
                          const sessionInfo = sessionLookup.get(sessionId);
                          if (!sessionInfo) return null;
                          return { sessionId, ...sessionInfo };
                        })
                        .filter((session): session is { sessionId: string; sessionName: string; projectName: string } => session !== null)
                        .slice(0, 5);
                      if (recentSessions.length === 0) return (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          No open sessions. Create one from the sidebar.
                        </div>
                      );
                      return (
                        <div style={{ width: 260 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            Recent Sessions
                          </div>
                          {recentSessions.map(({ sessionId, sessionName, projectName }) => (
                            <button
                              key={sessionId}
                              onClick={() => { setShowSettings(false); store.selectSession(sessionId); }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                fontSize: 12,
                                color: 'var(--text-primary)',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ fontWeight: 500 }}>{sessionName}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{projectName}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
      {projectSwitcherVisible && projectSwitcherProjectId && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.22)',
            pointerEvents: 'none',
            zIndex: 40,
          }}
        >
          <div
            style={{
              minWidth: 420,
              maxWidth: 760,
              padding: 14,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(16, 16, 16, 0.96)',
              boxShadow: '0 22px 60px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 12 }}>
              Project Switcher
            </div>
            <div style={{ display: 'grid', gap: 10, alignItems: 'stretch', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))' }}>
              {focusModeProjects.map((project) => {
                const isActive = project.id === projectSwitcherProjectId;
                const terminalCount = project.sessions.length;
                return (
                  <div
                    key={project.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: isActive ? 'rgba(38, 38, 38, 0.96)' : 'rgba(26, 26, 26, 0.96)',
                      border: isActive ? '1px solid rgba(34, 197, 94, 0.45)' : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: isActive ? 'inset 0 0 0 1px rgba(34, 197, 94, 0.12)' : 'inset 0 0 0 1px rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{
                        display: 'inline-block',
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: isActive ? 'var(--activity-serving)' : 'rgba(255,255,255,0.18)',
                        flexShrink: 0,
                        boxShadow: isActive ? '0 0 10px rgba(34,197,94,0.35)' : 'none',
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {project.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        {isActive ? 'Selected' : 'Queued'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {terminalCount} terminal{terminalCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
              Hold `Ctrl`, press `Tab` to cycle, release `Ctrl` to switch.
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
