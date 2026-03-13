import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, Session, SessionGroup, StoreData, LayoutType, ThemeMode, ClaudeMode, OpenDefault } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function useStore() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [terminalBgColor, setTerminalBgColorState] = useState<string>('#171717');
  const [openedSessionIds, setOpenedSessionIds] = useState<Set<string>>(new Set());
  const [shellPath, setShellPathState] = useState<string>('');
  const [shellArgs, setShellArgsState] = useState<string[]>([]);
  const [claudeDefault, setClaudeDefaultState] = useState<ClaudeMode>('claude');
  const [openDefault, setOpenDefaultState] = useState<OpenDefault>('cursor');
  const [autoCopy, setAutoCopyState] = useState<boolean>(false);
  const [rightClickPaste, setRightClickPasteState] = useState<boolean>(false);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([]);

  // Load on mount
  useEffect(() => {
    window.electronAPI.store.load().then((data) => {
      setProjects(data.projects);
      // Don't restore active session — start on welcome screen
      // setActiveSessionId(data.activeSessionId);
      if (data.theme) setThemeState(data.theme);
      if (data.terminalBgColor) setTerminalBgColorState(data.terminalBgColor);
      if (data.openedSessionIds) setOpenedSessionIds(new Set(data.openedSessionIds));
      if (data.shellPath) setShellPathState(data.shellPath);
      if (data.shellArgs) setShellArgsState(data.shellArgs);
      if (data.claudeDefault) setClaudeDefaultState(data.claudeDefault);
      if (data.openDefault) setOpenDefaultState(data.openDefault);
      if (data.autoCopy != null) setAutoCopyState(data.autoCopy);
      if (data.rightClickPaste != null) setRightClickPasteState(data.rightClickPaste);
      if (data.sessionGroups) setSessionGroups(data.sessionGroups);
    });
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Persist helper
  const openedIdsRef = useRef(openedSessionIds);
  openedIdsRef.current = openedSessionIds;
  const shellPathRef = useRef(shellPath);
  shellPathRef.current = shellPath;
  const shellArgsRef = useRef(shellArgs);
  shellArgsRef.current = shellArgs;
  const claudeDefaultRef = useRef(claudeDefault);
  claudeDefaultRef.current = claudeDefault;
  const openDefaultRef = useRef(openDefault);
  openDefaultRef.current = openDefault;
  const autoCopyRef = useRef(autoCopy);
  autoCopyRef.current = autoCopy;
  const rightClickPasteRef = useRef(rightClickPaste);
  rightClickPasteRef.current = rightClickPaste;
  const sessionGroupsRef = useRef(sessionGroups);
  sessionGroupsRef.current = sessionGroups;

  const persist = useCallback((newProjects: Project[], newActiveId: string | null, newTheme?: ThemeMode, newBgColor?: string, newOpenedIds?: string[]) => {
    const data: StoreData = {
      projects: newProjects,
      activeSessionId: newActiveId,
      theme: newTheme,
      terminalBgColor: newBgColor,
      openedSessionIds: newOpenedIds ?? [...openedIdsRef.current],
      shellPath: shellPathRef.current || undefined,
      shellArgs: shellArgsRef.current.length ? shellArgsRef.current : undefined,
      claudeDefault: claudeDefaultRef.current,
      openDefault: openDefaultRef.current,
      autoCopy: autoCopyRef.current,
      rightClickPaste: rightClickPasteRef.current,
      sessionGroups: sessionGroupsRef.current.length ? sessionGroupsRef.current : undefined,
    };
    window.electronAPI.store.save(data);
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    persist(projects, activeSessionId, newTheme, terminalBgColor);
  }, [projects, activeSessionId, terminalBgColor, persist]);

  const markSessionOpened = useCallback((sessionId: string) => {
    setOpenedSessionIds((prev) => {
      if (prev.has(sessionId)) return prev;
      const next = new Set(prev);
      next.add(sessionId);
      openedIdsRef.current = next;
      return next;
    });
  }, []);

  const closeSession = useCallback((sessionId: string) => {
    setOpenedSessionIds((prev) => {
      if (!prev.has(sessionId)) return prev;
      const next = new Set(prev);
      next.delete(sessionId);
      openedIdsRef.current = next;
      return next;
    });
  }, []);

  const setTerminalBgColor = useCallback((color: string) => {
    setTerminalBgColorState(color);
    persist(projects, activeSessionId, theme, color);
  }, [projects, activeSessionId, theme, persist]);

  const setShellConfig = useCallback((path: string, args: string[]) => {
    setShellPathState(path);
    setShellArgsState(args);
    shellPathRef.current = path;
    shellArgsRef.current = args;
    persist(projects, activeSessionId, theme, terminalBgColor);
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const setClaudeDefault = useCallback((mode: ClaudeMode) => {
    setClaudeDefaultState(mode);
    claudeDefaultRef.current = mode;
    persist(projects, activeSessionId, theme, terminalBgColor);
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const setOpenDefault = useCallback((mode: OpenDefault) => {
    setOpenDefaultState(mode);
    openDefaultRef.current = mode;
    persist(projects, activeSessionId, theme, terminalBgColor);
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const setAutoCopy = useCallback((enabled: boolean) => {
    setAutoCopyState(enabled);
    autoCopyRef.current = enabled;
    persist(projects, activeSessionId, theme, terminalBgColor);
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const setRightClickPaste = useCallback((enabled: boolean) => {
    setRightClickPasteState(enabled);
    rightClickPasteRef.current = enabled;
    persist(projects, activeSessionId, theme, terminalBgColor);
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const addProject = useCallback(async () => {
    const dirPath = await window.electronAPI.dialog.openDirectory();
    if (!dirPath) return;

    const name = dirPath.split(/[\\/]/).pop() || dirPath;
    const project: Project = {
      id: generateId(),
      name,
      path: dirPath,
      sessions: [],
    };

    setProjects((prev) => {
      const next = [...prev, project];
      persist(next, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

  const removeProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      const removed = prev.find((p) => p.id === projectId);
      const removedSessionIds = removed?.sessions.map((s) => s.id) || [];
      for (const id of removedSessionIds) closeSession(id);
      const next = prev.filter((p) => p.id !== projectId);
      let newActive = activeSessionId;
      if (newActive && removedSessionIds.includes(newActive)) {
        newActive = null;
      }
      setActiveSessionId(newActive);
      persist(next, newActive, theme, terminalBgColor, [...openedIdsRef.current]);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist, closeSession]);

  const addSession = useCallback((projectId: string) => {
    setProjects((prev) => {
      const project = prev.find((p) => p.id === projectId);
      if (!project) return prev;

      const session: Session = {
        id: generateId(),
        projectId,
        name: `Session ${project.sessions.length + 1}`,
        lastCommand: '',
        layout: 'single',
        createdAt: Date.now(),
      };

      const next = prev.map((p) =>
        p.id === projectId ? { ...p, sessions: [...p.sessions, session] } : p
      );
      setActiveSessionId(session.id);
      markSessionOpened(session.id);
      persist(next, session.id, theme, terminalBgColor, [...openedIdsRef.current]);
      return next;
    });
  }, [theme, terminalBgColor, persist, markSessionOpened]);

  const removeSession = useCallback((sessionId: string) => {
    closeSession(sessionId);
    // Clean up any groups containing this session
    setSessionGroups((prev) => {
      const next = prev.filter((g) => !g.sessionIds.includes(sessionId));
      sessionGroupsRef.current = next;
      return next;
    });
    setProjects((prev) => {
      const next = prev.map((p) => ({
        ...p,
        sessions: p.sessions.filter((s) => s.id !== sessionId),
      }));
      let newActive = activeSessionId;
      if (newActive === sessionId) {
        newActive = null;
      }
      setActiveSessionId(newActive);
      persist(next, newActive, theme, terminalBgColor, [...openedIdsRef.current]);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist, closeSession]);

  const renameSession = useCallback((sessionId: string, name: string) => {
    setProjects((prev) => {
      const next = prev.map((p) => ({
        ...p,
        sessions: p.sessions.map((s) =>
          s.id === sessionId ? { ...s, name } : s
        ),
      }));
      persist(next, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

  const reorderSessions = useCallback((projectId: string, fromIndex: number, toIndex: number) => {
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.id !== projectId) return p;
        const sessions = [...p.sessions];
        const [moved] = sessions.splice(fromIndex, 1);
        sessions.splice(toIndex, 0, moved);
        return { ...p, sessions };
      });
      persist(next, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

  const reorderGroupSessions = useCallback((projectId: string, sessionIds: [string, string], toIndex: number) => {
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.id !== projectId) return p;
        const sessions = [...p.sessions];
        // Collect the sessions to move
        const toMove = sessionIds.map((id) => sessions.find((s) => s.id === id)!);
        // Remove them from back to front to keep indices valid
        const indices = sessionIds
          .map((id) => sessions.findIndex((s) => s.id === id))
          .sort((a, b) => b - a);
        for (const idx of indices) sessions.splice(idx, 1);
        // Adjust insert position for removed items that were before it
        let insertAt = toIndex;
        for (const idx of indices.sort((a, b) => a - b)) {
          if (idx < toIndex) insertAt--;
        }
        insertAt = Math.max(0, Math.min(insertAt, sessions.length));
        sessions.splice(insertAt, 0, ...toMove);
        return { ...p, sessions };
      });
      persist(next, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

  const setSessionLayout = useCallback((sessionId: string, layout: LayoutType) => {
    setProjects((prev) => {
      const next = prev.map((p) => ({
        ...p,
        sessions: p.sessions.map((s) =>
          s.id === sessionId ? { ...s, layout } : s
        ),
      }));
      persist(next, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

  const updateSessionLastCommand = useCallback((sessionId: string, lastCommand: string) => {
    setProjects((prev) => {
      const next = prev.map((p) => ({
        ...p,
        sessions: p.sessions.map((s) =>
          s.id === sessionId ? { ...s, lastCommand } : s
        ),
      }));
      persist(next, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    markSessionOpened(sessionId);
    persist(projects, sessionId, theme, terminalBgColor, [...openedIdsRef.current]);
  }, [projects, theme, terminalBgColor, persist, markSessionOpened]);

  const addSessionGroup = useCallback((sessionIds: [string, string], name?: string) => {
    const group: SessionGroup = { id: generateId(), name: name || 'Group', sessionIds };
    setSessionGroups((prev) => {
      // Remove any existing groups containing these sessions
      const filtered = prev.filter((g) => !g.sessionIds.some((id) => sessionIds.includes(id)));
      const next = [...filtered, group];
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
    return group.id;
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const removeSessionGroup = useCallback((groupId: string) => {
    setSessionGroups((prev) => {
      const next = prev.filter((g) => g.id !== groupId);
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const renameSessionGroup = useCallback((groupId: string, name: string) => {
    setSessionGroups((prev) => {
      const next = prev.map((g) => g.id === groupId ? { ...g, name } : g);
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const updateGroupColor = useCallback((groupId: string, color: string) => {
    setSessionGroups((prev) => {
      const next = prev.map((g) => g.id === groupId ? { ...g, color } : g);
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  // Find active session and its project
  const activeSession = projects
    .flatMap((p) => p.sessions)
    .find((s) => s.id === activeSessionId) || null;
  const activeProject = activeSession
    ? projects.find((p) => p.id === activeSession.projectId) || null
    : null;

  return {
    projects,
    activeSessionId,
    activeSession,
    activeProject,
    openedSessionIds,
    theme,
    setTheme,
    terminalBgColor,
    setTerminalBgColor,
    shellPath,
    shellArgs,
    setShellConfig,
    claudeDefault,
    setClaudeDefault,
    openDefault,
    setOpenDefault,
    autoCopy,
    setAutoCopy,
    rightClickPaste,
    setRightClickPaste,
    addProject,
    removeProject,
    addSession,
    removeSession,
    selectSession,
    renameSession,
    reorderSessions,
    reorderGroupSessions,
    setSessionLayout,
    updateSessionLastCommand,
    sessionGroups,
    addSessionGroup,
    removeSessionGroup,
    renameSessionGroup,
    updateGroupColor,
  };
}
