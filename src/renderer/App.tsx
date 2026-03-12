import { useCallback, useEffect, useRef, useState, createRef } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { TerminalArea } from './components/TerminalArea';
import type { TerminalPaneHandle } from './components/TerminalPane';
import { Settings } from './components/Settings';
import { useStore } from './hooks/useStore';

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
  const [sessionServerUrls, setSessionServerUrls] = useState<Record<string, string>>({});
  const serverUrlFoundRef = useRef<Record<string, boolean>>({});
  const chimeSuppressUntilRef = useRef<Record<string, number>>({});
  const terminalRefs = useRef<Record<string, React.RefObject<TerminalPaneHandle | null>>>({});

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
    }
    prevActiveSessionRef.current = store.activeSessionId;
  }, [store.activeSessionId]);

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

  const SERVER_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)/;
  // Detect crash/error patterns in PTY output (case-insensitive, stripped of ANSI codes)
  const ERROR_RE = /\b(ERROR|FATAL|ELIFECYCLE|SIGABRT|SIGSEGV|panic:|Traceback \(most recent|Unhandled rejection|Cannot find module|segmentation fault|core dumped|ENOSPC|ENOMEM)\b|npm ERR!|error Command failed/i;
  const errorDetectedRef = useRef<Record<string, boolean>>({});

  // ── PTY output handler ──
  // Strategy: every output chunk resets a 2s debounce timer.
  // When no output arrives for 2s → busy transitions to completed (or error if errors were seen).
  // completed/error does NOT transition back to busy on output — only on explicit user action.
  const handlePtyOutput = useCallback((sessionId: string, data: string) => {
    const currentState = activityRef.current[sessionId];
    if (!currentState) return;

    // Scan for localhost URLs to auto-detect server mode
    if (!serverUrlFoundRef.current[sessionId]) {
      const match = data.match(SERVER_URL_RE);
      if (match) {
        const url = match[0].replace('0.0.0.0', 'localhost');
        serverUrlFoundRef.current[sessionId] = true;
        setSessionServerUrls((prev) => ({ ...prev, [sessionId]: url }));
        setActivity(sessionId, 'serving');
        clearTimeout(activityTimers.current[sessionId]);
        return;
      }
    }

    // Only track output for 'busy' sessions. All other states ignore output.
    if (currentState !== 'busy') return;

    // Scan for error patterns (strip ANSI escape codes first)
    if (!errorDetectedRef.current[sessionId]) {
      // eslint-disable-next-line no-control-regex
      const plain = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      if (ERROR_RE.test(plain)) {
        errorDetectedRef.current[sessionId] = true;
      }
    }

    // Reset the "output gap" timer — command is still producing output
    clearTimeout(activityTimers.current[sessionId]);
    activityTimers.current[sessionId] = setTimeout(() => {
      delete activityTimers.current[sessionId];
      if (activityRef.current[sessionId] !== 'busy') return;

      const hadError = errorDetectedRef.current[sessionId];
      const finalState = hadError ? 'error' : 'completed';
      const busyDuration = Date.now() - (busySinceRef.current[sessionId] || 0);
      setActivity(sessionId, finalState);

      // Play chime if command ran long enough and chimes aren't suppressed
      const chimesSuppressed = Date.now() < (chimeSuppressUntilRef.current[sessionId] || 0);
      if (busyDuration > CHIME_MIN_BUSY_MS && !chimesSuppressed) {
        playDoneSound();
      }

      // Decay completed/error → idle after a while
      clearTimeout(idleDecayTimers.current[sessionId]);
      idleDecayTimers.current[sessionId] = setTimeout(() => {
        const s = activityRef.current[sessionId];
        if (s === 'completed' || s === 'error') {
          setActivity(sessionId, 'idle');
        }
      }, COMPLETED_DECAY_MS);
    }, OUTPUT_GAP_MS);
  }, [playDoneSound, setActivity]);

  const SERVER_SCRIPT_NAMES = /^(dev|start|serve|watch|preview)$/;
  const SERVER_CMD_RE = /(?:npm\s+(?:run\s+)?|yarn\s+(?:run\s+)?|pnpm\s+(?:run\s+)?|bun\s+(?:run\s+)?)(dev|start|serve|watch|preview)$|electron-forge\s+start/;

  // ── Transition to busy ──
  // Called when the user explicitly starts a command (Enter key or button click).
  const markBusy = useCallback((sessionId: string) => {
    clearTimeout(activityTimers.current[sessionId]);
    delete activityTimers.current[sessionId];
    clearTimeout(idleDecayTimers.current[sessionId]);
    errorDetectedRef.current[sessionId] = false;
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

  const sessionProjectMap = new Map<string, { session: typeof store.activeSession; projectPath: string }>();
  for (const project of store.projects) {
    for (const session of project.sessions) {
      if (store.openedSessionIds.has(session.id)) {
        sessionProjectMap.set(session.id, { session, projectPath: project.path });
      }
    }
  }

  const handleTerminalData = useCallback((sessionId: string, data: string) => {
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
        }
      }
      inputBufferRef.current[sessionId] = '';
    } else if (data === '\x7f') {
      inputBufferRef.current[sessionId] = (inputBufferRef.current[sessionId] || '').slice(0, -1);
    } else if (data.length === 1 && data >= ' ') {
      inputBufferRef.current[sessionId] = (inputBufferRef.current[sessionId] || '') + data;
    }
  }, [store.updateSessionLastCommand, markBusy, setActivity]);

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
            onSelectSession={(id) => { setShowSettings(false); store.selectSession(id); }}
            onRenameSession={store.renameSession}
            onReorderSessions={store.reorderSessions}
            sessionActivity={sessionActivity}
            sessionServerUrls={sessionServerUrls}
            onOpenSettings={() => setShowSettings(true)}
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
              {store.activeSessionId && <HeaderBar
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
                        // Small delay to let focus events settle before writing
                        setTimeout(() => ref.current?.write(cmd), 50);
                      }
                    }
                  : null
                }
                onRunScript={store.activeSessionId
                  ? (scriptName: string, cmd: string) => handleRunScript(store.activeSessionId!, scriptName, cmd)
                  : null
                }
              />}
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {[...sessionProjectMap.entries()].map(([sessionId, { session, projectPath }]) => (
                  <div
                    key={sessionId}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      visibility: !showSettings && sessionId === store.activeSessionId ? 'visible' : 'hidden',
                      pointerEvents: !showSettings && sessionId === store.activeSessionId ? 'auto' : 'none',
                    }}
                  >
                    <TerminalArea
                      ref={(() => {
                        if (!terminalRefs.current[sessionId]) {
                          terminalRefs.current[sessionId] = createRef();
                        }
                        return terminalRefs.current[sessionId];
                      })()}
                      sessionId={sessionId}
                      layout={session!.layout}
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
                ))}

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
