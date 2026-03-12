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
  const inputBufferRef = useRef('');
  const [showSettings, setShowSettings] = useState(false);
  const [sessionActivity, setSessionActivity] = useState<Record<string, 'idle' | 'completed' | 'busy' | 'serving'>>({});
  const activityTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const idleDecayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activityRef = useRef<Record<string, 'idle' | 'completed' | 'busy' | 'serving'>>({});
  const busySinceRef = useRef<Record<string, number>>({});
  const [sessionServerUrls, setSessionServerUrls] = useState<Record<string, string>>({});
  const serverUrlFoundRef = useRef<Record<string, boolean>>({});
  const activitySuppressUntilRef = useRef<Record<string, number>>({});
  const terminalRefs = useRef<Record<string, React.RefObject<TerminalPaneHandle | null>>>({});

  // Set all opened sessions to 'idle' (gray dot). They stay gray until selected.
  const initSession = useCallback((sessionId: string) => {
    if (activityRef.current[sessionId]) return;
    activityRef.current[sessionId] = 'idle';
    setSessionActivity((prev) => ({ ...prev, [sessionId]: 'idle' }));
  }, []);

  useEffect(() => {
    for (const id of store.openedSessionIds) {
      initSession(id);
    }
  }, [store.openedSessionIds, initSession]);

  // Suppress chime briefly on tab switch (resize causes PTY redraw)
  const prevActiveSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (store.activeSessionId && store.activeSessionId !== prevActiveSessionRef.current) {
      const now = Date.now() + 3000;
      activitySuppressUntilRef.current[store.activeSessionId] = now;
      if (prevActiveSessionRef.current) {
        activitySuppressUntilRef.current[prevActiveSessionRef.current] = now;
      }
    }
    prevActiveSessionRef.current = store.activeSessionId;
  }, [store.activeSessionId]);

  const playDoneSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      // Two-tone chime
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

  const handlePtyOutput = useCallback((sessionId: string, data: string) => {
    initSession(sessionId);

    // While starting, ignore activity tracking
    if (activityRef.current[sessionId] === 'idle') return;

    const chimesSuppressed = Date.now() < (activitySuppressUntilRef.current[sessionId] || 0);
    const currentState = activityRef.current[sessionId];

    // Scan for localhost URLs to auto-detect server mode
    if (!serverUrlFoundRef.current[sessionId]) {
      const match = data.match(SERVER_URL_RE);
      if (match) {
        const url = match[0].replace('0.0.0.0', 'localhost');
        serverUrlFoundRef.current[sessionId] = true;
        setSessionServerUrls((prev) => ({ ...prev, [sessionId]: url }));
        activityRef.current[sessionId] = 'serving';
        setSessionActivity((prev) => ({ ...prev, [sessionId]: 'serving' }));
        clearTimeout(activityTimers.current[sessionId]);
        return;
      }
    }

    // If already serving, just cancel any pending timer — stay serving, no chime
    if (currentState === 'serving') {
      clearTimeout(activityTimers.current[sessionId]);
      return;
    }

    // Only track output for sessions already in 'busy' state.
    // Transitions to busy happen explicitly (Enter key, script run, Claude button)
    // so shell echo from typing won't trigger a false busy state.
    if (currentState !== 'busy') return;

    clearTimeout(idleDecayTimers.current[sessionId]);
    clearTimeout(activityTimers.current[sessionId]);
    activityTimers.current[sessionId] = setTimeout(() => {
      const wasBusy = activityRef.current[sessionId] === 'busy';
      const busyDuration = Date.now() - (busySinceRef.current[sessionId] || 0);
      activityRef.current[sessionId] = 'completed';
      setSessionActivity((prev) => ({ ...prev, [sessionId]: 'completed' }));
      if (wasBusy && busyDuration > 5000 && !chimesSuppressed) {
        playDoneSound();
      }
      // After 10 min of completed, decay back to idle (gray)
      idleDecayTimers.current[sessionId] = setTimeout(() => {
        if (activityRef.current[sessionId] === 'completed') {
          activityRef.current[sessionId] = 'idle';
          setSessionActivity((prev) => ({ ...prev, [sessionId]: 'idle' }));
        }
      }, 10 * 60 * 1000);
    }, 5000);
  }, [playDoneSound, initSession]);

  const SERVER_SCRIPT_NAMES = /^(dev|start|serve|watch|preview)$/;
  const SERVER_CMD_RE = /(?:npm\s+(?:run\s+)?|yarn\s+(?:run\s+)?|pnpm\s+(?:run\s+)?|bun\s+(?:run\s+)?)(dev|start|serve|watch|preview)$|electron-forge\s+start/;

  const handleRunScript = useCallback((sessionId: string, scriptName: string, cmd: string) => {
    // If it's a server-like script, pre-set serving mode immediately
    if (SERVER_SCRIPT_NAMES.test(scriptName)) {
      activityRef.current[sessionId] = 'serving';
      setSessionActivity((prev) => ({ ...prev, [sessionId]: 'serving' }));
    } else {
      activityRef.current[sessionId] = 'busy';
      busySinceRef.current[sessionId] = Date.now();
      setSessionActivity((prev) => ({ ...prev, [sessionId]: 'busy' }));
    }
    // Write the command to the terminal
    const ref = terminalRefs.current[sessionId];
    if (ref?.current) {
      ref.current.write(cmd);
      ref.current.focus();
    }
  }, []);

  const sessionProjectMap = new Map<string, { session: typeof store.activeSession; projectPath: string }>();
  for (const project of store.projects) {
    for (const session of project.sessions) {
      if (store.openedSessionIds.has(session.id)) {
        sessionProjectMap.set(session.id, { session, projectPath: project.path });
      }
    }
  }

  const handleTerminalData = useCallback((sessionId: string, data: string) => {
    // Ctrl+C while serving → exit serving mode
    if (data === '\x03' && activityRef.current[sessionId] === 'serving') {
      activityRef.current[sessionId] = 'busy';
      serverUrlFoundRef.current[sessionId] = false;
      setSessionActivity((prev) => ({ ...prev, [sessionId]: 'busy' }));
      setSessionServerUrls((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }

    if (data === '\r') {
      const cmd = inputBufferRef.current.trim();
      if (cmd) {
        store.updateSessionLastCommand(sessionId, cmd);
        // Detect server-like commands and enter serving mode (without URL)
        if (SERVER_CMD_RE.test(cmd)) {
          activityRef.current[sessionId] = 'serving';
          setSessionActivity((prev) => ({ ...prev, [sessionId]: 'serving' }));
        } else if (activityRef.current[sessionId] === 'idle') {
          // Transition out of idle so handlePtyOutput starts tracking activity
          activityRef.current[sessionId] = 'busy';
          busySinceRef.current[sessionId] = Date.now();
          setSessionActivity((prev) => ({ ...prev, [sessionId]: 'busy' }));
        }
      }
      inputBufferRef.current = '';
    } else if (data === '\x7f') {
      inputBufferRef.current = inputBufferRef.current.slice(0, -1);
    } else if (data.length === 1 && data >= ' ') {
      inputBufferRef.current += data;
    }
  }, [store.updateSessionLastCommand]);

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
                      if (activityRef.current[sid] === 'idle') {
                        activityRef.current[sid] = 'busy';
                        busySinceRef.current[sid] = Date.now();
                        setSessionActivity((prev) => ({ ...prev, [sid]: 'busy' }));
                      }
                      const ref = terminalRefs.current[sid];
                      if (ref?.current) {
                        ref.current.write(cmd);
                        ref.current.focus();
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
