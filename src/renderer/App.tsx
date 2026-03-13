import { useCallback, useEffect, useRef, useState, createRef } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { TerminalArea } from './components/TerminalArea';
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

function getAvailableGroupLayouts(count: number): LayoutType[] {
  if (count >= 4) return ['grid'];
  if (count === 3) return ['three'];
  if (count === 2) return ['vsplit'];
  return ['single'];
}

function getGroupContainerStyle(layout: LayoutType, count: number): React.CSSProperties {
  if (count <= 1 || layout === 'single') {
    return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
  }
  if (layout === 'grid' && count >= 4) {
    return {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
    };
  }
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    gridTemplateRows: '1fr',
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
  const [sessionActivity, setSessionActivity] = useState<Record<string, ActivityState>>({});
  const activityTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const idleDecayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activityRef = useRef<Record<string, ActivityState>>({});
  const busySinceRef = useRef<Record<string, number>>({});
  const interactiveRef = useRef<Record<string, boolean>>({});
  const [sessionServerUrls, setSessionServerUrls] = useState<Record<string, string>>({});
  const serverUrlFoundRef = useRef<Record<string, boolean>>({});
  const chimeSuppressUntilRef = useRef<Record<string, number>>({});
  const terminalRefs = useRef<Record<string, React.RefObject<TerminalPaneHandle | null>>>({});
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // How long after last PTY output before we consider a command "done"
  const OUTPUT_GAP_MS = 2000;
  // How long "completed" (green) stays before decaying to idle (gray)
  const COMPLETED_DECAY_MS = 60_000;
  // Minimum busy duration before playing completion chime
  const CHIME_MIN_BUSY_MS = 5000;

  const setActivity = useCallback((sessionId: string, state: ActivityState) => {
    activityRef.current[sessionId] = state;
    setSessionActivity((prev) => ({ ...prev, [sessionId]: state }));
  }, []);

  // Initialize opened sessions to 'idle'
  useEffect(() => {
    for (const id of store.openedSessionIds) {
      if (!activityRef.current[id]) {
        activityRef.current[id] = 'idle';
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

      // If switching back to a completed/error tab, start the idle decay then.
      const state = activityRef.current[store.activeSessionId];
      if (state === 'completed' || state === 'error') {
        clearTimeout(idleDecayTimers.current[store.activeSessionId]);
        idleDecayTimers.current[store.activeSessionId] = setTimeout(() => {
          const s = activityRef.current[store.activeSessionId!];
          if (s === 'completed' || s === 'error') {
            setActivity(store.activeSessionId!, 'idle');
          }
        }, COMPLETED_DECAY_MS);
      }
    }
    prevActiveSessionRef.current = store.activeSessionId;
  }, [store.activeSessionId, setActivity]);

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
  const SERVER_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)/;
  // const ERROR_RE = /\bERROR\b|npm ERR!/;
  const errorDetectedRef = useRef<Record<string, boolean>>({});

  // ── PTY output handler ──
  // Strategy: every output chunk resets a 2s debounce timer.
  // When no output arrives for 2s → busy transitions to completed (or error if errors were seen).
  // completed/error does NOT transition back to busy on output — only on explicit user action.
  const handlePtyOutput = useCallback((sessionId: string, data: string) => {
    const currentState = activityRef.current[sessionId];
    if (!currentState) return;

    // Capture server URL from output only when already in serving mode (triggered by command detection)
    if (currentState === 'serving' && !serverUrlFoundRef.current[sessionId]) {
      const match = data.match(SERVER_URL_RE);
      if (match) {
        const url = match[0].replace('0.0.0.0', 'localhost');
        serverUrlFoundRef.current[sessionId] = true;
        setSessionServerUrls((prev) => ({ ...prev, [sessionId]: url }));
      }
    }

    // Only track output for 'busy' sessions. All other states ignore output.
    if (currentState !== 'busy') return;

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
      if (activityRef.current[sessionId] !== 'busy') return;

      // const hadError = errorDetectedRef.current[sessionId];
      const finalState = 'completed';
      const busyDuration = Date.now() - (busySinceRef.current[sessionId] || 0);
      setActivity(sessionId, finalState);

      // Play chime if command ran long enough and chimes aren't suppressed
      const chimesSuppressed = Date.now() < (chimeSuppressUntilRef.current[sessionId] || 0);
      if (busyDuration > CHIME_MIN_BUSY_MS && !chimesSuppressed) {
        playDoneSound();
      }

      // Do not decay immediately on completion. Keep completed visible until
      // the user revisits that session, then the tab-switch effect starts the timer.
      clearTimeout(idleDecayTimers.current[sessionId]);
    }, gapMs);
  }, [playDoneSound, setActivity, store.activeSessionId]);

  const SERVER_SCRIPT_NAMES = /^(dev|start|[\w:-]*:?listen[\w:-]*)$/;
  const SERVER_CMD_RE = /(?:npm\s+(?:run\s+)?|yarn\s+(?:run\s+)?|pnpm\s+(?:run\s+)?|bun\s+(?:run\s+)?)(dev|start|[\w:-]*:?listen[\w:-]*)$|electron-forge\s+start|convex\s+dev/;
  // Commands that are long-running interactive tools (not servers, but shouldn't trigger idle on output gaps)
  const INTERACTIVE_CMD_RE = /\bclaude\b|\bcodex\b/;

  // ── Transition to busy ──
  // Called when the user explicitly starts a command (Enter key or button click).
  const markBusy = useCallback((sessionId: string) => {
    clearTimeout(activityTimers.current[sessionId]);
    delete activityTimers.current[sessionId];
    clearTimeout(idleDecayTimers.current[sessionId]);
    errorDetectedRef.current[sessionId] = false;
    interactiveRef.current[sessionId] = false;
    busySinceRef.current[sessionId] = Date.now();
    setActivity(sessionId, 'busy');
  }, [setActivity]);

  const handleRunScript = useCallback((sessionId: string, scriptName: string, cmd: string) => {
    if (SERVER_SCRIPT_NAMES.test(scriptName)) {
      setActivity(sessionId, 'serving');
    } else {
      markBusy(sessionId);
    }
    const ref = terminalRefs.current[sessionId];
    if (ref?.current) {
      ref.current.focus();
      setTimeout(() => ref.current?.write(cmd), 50);
    }
  }, [setActivity, markBusy]);

  const sessionProjectMap = new Map<string, { session: Session; projectPath: string }>();
  for (const project of store.projects) {
    for (const session of project.sessions) {
      if (store.openedSessionIds.has(session.id)) {
        sessionProjectMap.set(session.id, { session, projectPath: project.path });
      }
    }
  }

  const handleTerminalData = useCallback((sessionId: string, data: string) => {
    // Ctrl+C clears interactive flag so output gap detection resumes
    if (data === '\x03') {
      interactiveRef.current[sessionId] = false;
    }
    // Ctrl+C while serving → exit serving mode, go to busy (will settle to completed via output gap)
    if (data === '\x03' && activityRef.current[sessionId] === 'serving') {
      serverUrlFoundRef.current[sessionId] = false;
      markBusy(sessionId);
      setSessionServerUrls((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }

    if (data === '\r') {
      const cmd = (inputBufferRef.current[sessionId] || '').trim();
      if (cmd) {
        store.updateSessionLastCommand(sessionId, cmd);
        // Detect server-like commands → serving mode immediately
        if (SERVER_CMD_RE.test(cmd)) {
          setActivity(sessionId, 'serving');
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
  }, [store.updateSessionLastCommand, markBusy, setActivity]);

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
    // Mark grouped sessions as opened and activate the group
    for (const id of sessionIds) {
      store.selectSession(id);
    }
    setActiveGroupId(groupId);
  }, [store.addSessionGroup, store.selectSession]);

  const handleUngroupSessions = useCallback((groupId: string) => {
    store.removeSessionGroup(groupId);
    if (activeGroupId === groupId) setActiveGroupId(null);
  }, [store.removeSessionGroup, activeGroupId]);

  // When selecting a session, check if it's part of a group and activate the group
  const handleSelectSession = useCallback((sessionId: string) => {
    setShowSettings(false);
    store.selectSession(sessionId);
    setSelectedSessionIds(new Set());
    const group = store.sessionGroups.find((g) => g.sessionIds.includes(sessionId));
    if (group) {
      setActiveGroupId(group.id);
      // Make sure both sessions are opened
      for (const id of group.sessionIds) {
        store.selectSession(id);
      }
    } else {
      setActiveGroupId(null);
    }
  }, [store.selectSession, store.sessionGroups]);

  // Find the active group for rendering
  const activeGroup = activeGroupId ? store.sessionGroups.find((g) => g.id === activeGroupId) || null : null;
  const activeGroupLayout = activeGroup?.layout || getDefaultGroupLayout(activeGroup?.sessionIds.length || 0);
  const activeGroupSessionIds = activeGroup
    ? activeGroup.sessionIds.filter((sessionId) => sessionProjectMap.has(sessionId))
    : [];
  const activeGroupSessions = activeGroupSessionIds
    .map((sessionId) => {
      const project = store.projects.find((p) => p.sessions.some((s) => s.id === sessionId)) || null;
      const session = project?.sessions.find((s) => s.id === sessionId) || null;
      if (!project || !session) return null;
      return { sessionId, project, session };
    })
    .filter(Boolean) as Array<{ sessionId: string; project: Project; session: Session }>;

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)' }}>
      <Allotment proportionalLayout={false}>
        <Allotment.Pane preferredSize={190} minSize={140} maxSize={300}>
          <Sidebar
            projects={store.projects}
            activeSessionId={store.activeSessionId}
            onAddProject={store.addProject}
            onRemoveProject={store.removeProject}
            onAddSession={store.addSession}
            onRemoveSession={store.removeSession}
            onSelectSession={handleSelectSession}
            onRenameSession={store.renameSession}
            onReorderSessions={store.reorderSessions}
            onReorderGroupSessions={store.reorderGroupSessions}
            sessionActivity={sessionActivity}
            sessionServerUrls={sessionServerUrls}
            onOpenSettings={() => setShowSettings(true)}
            selectedSessionIds={selectedSessionIds}
            onToggleSelectSession={handleToggleSelectSession}
            sessionGroups={store.sessionGroups}
            onGroupSessions={handleGroupSessions}
            onUngroupSessions={handleUngroupSessions}
            onRenameGroup={store.renameSessionGroup}
            onSetGroupLayout={(groupId, layout) => store.updateGroupLayout(groupId, layout)}
            activeGroupId={activeGroupId}
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
                onClose={() => setShowSettings(false)}
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', visibility: showSettings ? 'hidden' : 'visible' }}>
              {activeGroup ? (
                <HeaderBar
                  projectName={null}
                  projectPath={store.activeProject?.path || null}
                  sessionName={activeGroup.name}
                  layout={activeGroupLayout}
                  availableLayouts={getAvailableGroupLayouts(activeGroupSessionIds.length)}
                  onLayoutChange={(layout) => store.updateGroupLayout(activeGroup.id, layout)}
                  onNewSession={null}
                  onRenameSession={(name: string) => store.renameSessionGroup(activeGroup.id, name)}
                  claudeDefault={store.claudeDefault}
                  openDefault={store.openDefault}
                  serverUrl={store.activeSessionId ? sessionServerUrls[store.activeSessionId] || null : null}
                  onRunCommand={store.activeSessionId
                    ? (cmd: string) => {
                        const sid = store.activeSessionId!;
                        markBusy(sid);
                        const ref = terminalRefs.current[sid];
                        if (ref?.current) {
                          ref.current.focus();
                          setTimeout(() => ref.current?.write(cmd), 50);
                        }
                      }
                    : null
                  }
                  onRunScript={store.activeSessionId
                    ? (scriptName: string, cmd: string) => handleRunScript(store.activeSessionId!, scriptName, cmd)
                    : null
                  }
                  groupColor={activeGroup.color || null}
                  onGroupColorChange={(color: string) => store.updateGroupColor(activeGroup.id, color)}
                />
              ) : store.activeSessionId ? (
                <HeaderBar
                  projectName={store.activeProject?.name || null}
                  projectPath={store.activeProject?.path || null}
                  sessionName={store.activeSession?.name || null}
                  layout={store.activeSession?.layout || null}
                  onLayoutChange={(layout) => {
                    if (store.activeSession) {
                      store.setSessionLayout(store.activeSession.id, layout);
                    }
                  }}
                  onNewSession={store.activeProject
                    ? () => store.addSession(store.activeProject!.id)
                    : null
                  }
                  onRenameSession={store.activeSession
                    ? (name: string) => store.renameSession(store.activeSession!.id, name)
                    : null
                  }
                  claudeDefault={store.claudeDefault}
                  openDefault={store.openDefault}
                  serverUrl={store.activeSessionId ? sessionServerUrls[store.activeSessionId] || null : null}
                  onRunCommand={store.activeSessionId
                    ? (cmd: string) => {
                        const sid = store.activeSessionId!;
                        markBusy(sid);
                        const ref = terminalRefs.current[sid];
                        if (ref?.current) {
                          ref.current.focus();
                          setTimeout(() => ref.current?.write(cmd), 50);
                        }
                      }
                    : null
                  }
                  onRunScript={store.activeSessionId
                    ? (scriptName: string, cmd: string) => handleRunScript(store.activeSessionId!, scriptName, cmd)
                    : null
                  }
                />
              ) : null}
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {activeGroup ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      ...getGroupContainerStyle(activeGroupLayout, activeGroupSessions.length),
                    }}
                  >
                    {activeGroupSessions.map(({ sessionId, project, session }, index) => (
                      <div
                        key={sessionId}
                        onMouseDown={() => {
                          if (store.activeSessionId !== sessionId) {
                            store.selectSession(sessionId);
                          }
                        }}
                        style={{
                          minWidth: 0,
                          minHeight: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          borderRight: activeGroupLayout !== 'grid' && index < activeGroupSessions.length - 1 ? '1px solid var(--border)' : undefined,
                          borderBottom: activeGroupLayout === 'grid' && index < 2 ? '1px solid var(--border)' : undefined,
                        }}
                      >
                        <GroupPaneHeader
                          sessionName={session.name}
                          projectName={project.name}
                          projectPath={project.path}
                          serverUrl={sessionServerUrls[sessionId] || null}
                          activity={sessionActivity[sessionId] || null}
                        />
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
                            cwd={project.path}
                            onTerminalData={(data) => handleTerminalData(sessionId, data)}
                            onPtyOutput={(data) => handlePtyOutput(sessionId, data)}
                            bgColor={store.terminalBgColor}
                            isActive
                            shellPath={store.shellPath}
                            shellArgs={store.shellArgs}
                            autoCopy={store.autoCopy}
                            rightClickPaste={store.rightClickPaste}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  [...sessionProjectMap.entries()].map(([sessionId, { session, projectPath }]) => {
                    const isVisible = !showSettings && sessionId === store.activeSessionId;
                    return (
                      <div
                        key={sessionId}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          visibility: isVisible ? 'visible' : 'hidden',
                          pointerEvents: isVisible ? 'auto' : 'none',
                        }}
                      >
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
                            isActive={sessionId === store.activeSessionId}
                            shellPath={store.shellPath}
                            shellArgs={store.shellArgs}
                            autoCopy={store.autoCopy}
                            rightClickPaste={store.rightClickPaste}
                          />
                        </div>
                      </div>
                    );
                  })
                )}

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
                      const recentSessions: { sessionId: string; sessionName: string; projectName: string }[] = [];
                      for (const project of store.projects) {
                        for (const session of project.sessions) {
                          if (store.openedSessionIds.has(session.id)) {
                            recentSessions.push({ sessionId: session.id, sessionName: session.name, projectName: project.name });
                          }
                        }
                      }
                      if (recentSessions.length === 0) return (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          No open sessions. Create one from the sidebar.
                        </div>
                      );
                      return (
                        <div style={{ width: 260 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            Open Sessions
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
    </div>
  );
}
