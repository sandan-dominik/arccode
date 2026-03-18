import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, Session, SessionGroup, SessionSplitGroup, StoreData, LayoutType, ThemeMode, ClaudeMode, OpenDefault } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function getDefaultGroupLayout(count: number): LayoutType {
  if (count >= 4) return 'grid';
  if (count === 3) return 'three';
  if (count === 2) return 'vsplit';
  return 'single';
}

function normalizeSessionGroup(group: SessionGroup): SessionGroup {
  const sessionIds = [...new Set(group.sessionIds)];
  const splitGroups = (group.splitGroups || [])
    .map((splitGroup) => ({
      ...splitGroup,
      sessionIds: splitGroup.sessionIds.filter((sessionId) => sessionIds.includes(sessionId)),
      layout: splitGroup.layout || getDefaultGroupLayout(splitGroup.sessionIds.length),
    }))
    .filter((splitGroup) => splitGroup.sessionIds.length > 1);

  return {
    ...group,
    sessionIds,
    collapsed: group.collapsed ?? false,
    splitGroups,
  };
}

export function useStore() {
  const [servingCommands, setServingCommandsState] = useState<string[]>(['npm run dev', 'npm run start']);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [focusedProjectId, setFocusedProjectIdState] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidthState] = useState<number>(250);
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
      const normalizedProjects = data.projects.map((project) => ({ ...project, isArchived: project.isArchived ?? false }));
      setProjects(normalizedProjects);
      if (data.focusedProjectId != null && normalizedProjects.some((project) => project.id === data.focusedProjectId && !project.isArchived)) {
        setFocusedProjectIdState(data.focusedProjectId);
      }
      if (data.sidebarWidth != null) setSidebarWidthState(data.sidebarWidth);
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
      if (data.servingCommands) setServingCommandsState(data.servingCommands);
      if (data.sessionGroups) setSessionGroups(data.sessionGroups.map(normalizeSessionGroup));
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
  const servingCommandsRef = useRef(servingCommands);
  servingCommandsRef.current = servingCommands;
  const sessionGroupsRef = useRef(sessionGroups);
  sessionGroupsRef.current = sessionGroups;
  const focusedProjectIdRef = useRef(focusedProjectId);
  focusedProjectIdRef.current = focusedProjectId;

  const persist = useCallback((newProjects: Project[], newActiveId: string | null, newTheme?: ThemeMode, newBgColor?: string, newOpenedIds?: string[], newFocusedProjectId?: string | null) => {
    const data: StoreData = {
      projects: newProjects,
      activeSessionId: newActiveId,
      focusedProjectId: newFocusedProjectId !== undefined ? newFocusedProjectId : focusedProjectIdRef.current,
      sidebarWidth,
      theme: newTheme,
      terminalBgColor: newBgColor,
      openedSessionIds: newOpenedIds ?? [...openedIdsRef.current],
      shellPath: shellPathRef.current || undefined,
      shellArgs: shellArgsRef.current.length ? shellArgsRef.current : undefined,
      claudeDefault: claudeDefaultRef.current,
      openDefault: openDefaultRef.current,
      autoCopy: autoCopyRef.current,
      rightClickPaste: rightClickPasteRef.current,
      servingCommands: servingCommandsRef.current,
      sessionGroups: sessionGroupsRef.current.length ? sessionGroupsRef.current : undefined,
    };
    window.electronAPI.store.save(data);
  }, [sidebarWidth]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    persist(projects, activeSessionId, newTheme, terminalBgColor);
  }, [projects, activeSessionId, terminalBgColor, persist]);

  const setSidebarWidth = useCallback((width: number) => {
    setSidebarWidthState(width);
    window.electronAPI.store.save({
      projects,
      activeSessionId,
      focusedProjectId: focusedProjectIdRef.current,
      sidebarWidth: width,
      theme,
      terminalBgColor,
      openedSessionIds: [...openedIdsRef.current],
      shellPath: shellPathRef.current || undefined,
      shellArgs: shellArgsRef.current.length ? shellArgsRef.current : undefined,
      claudeDefault: claudeDefaultRef.current,
      openDefault: openDefaultRef.current,
      autoCopy: autoCopyRef.current,
      rightClickPaste: rightClickPasteRef.current,
      servingCommands: servingCommandsRef.current,
      sessionGroups: sessionGroupsRef.current.length ? sessionGroupsRef.current : undefined,
    });
  }, [projects, activeSessionId, theme, terminalBgColor]);

  const markSessionOpened = useCallback((sessionId: string) => {
    setOpenedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      }
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

  const setServingCommands = useCallback((commands: string[]) => {
    const normalized = [...new Set(
      commands
        .map((command) => command.trim())
        .filter(Boolean)
    )];
    setServingCommandsState(normalized);
    servingCommandsRef.current = normalized;
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
      isArchived: false,
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
      const nextSessionGroups = sessionGroupsRef.current
        .filter((group) => !group.sessionIds.some((id) => removedSessionIds.includes(id)))
        .map(normalizeSessionGroup);
      sessionGroupsRef.current = nextSessionGroups;
      setSessionGroups(nextSessionGroups);
      const next = prev.filter((p) => p.id !== projectId);
      let newActive = activeSessionId;
      if (newActive && removedSessionIds.includes(newActive)) {
        newActive = null;
      }
      const nextFocusedProjectId = focusedProjectIdRef.current === projectId ? null : focusedProjectIdRef.current;
      setFocusedProjectIdState(nextFocusedProjectId);
      setActiveSessionId(newActive);
      persist(next, newActive, theme, terminalBgColor, [...openedIdsRef.current], nextFocusedProjectId);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist, closeSession]);

  const archiveProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      const next = prev.map((project) => (
        project.id === projectId ? { ...project, isArchived: true } : project
      ));
      const nextFocusedProjectId = focusedProjectIdRef.current === projectId ? null : focusedProjectIdRef.current;
      setFocusedProjectIdState(nextFocusedProjectId);
      persist(next, activeSessionId, theme, terminalBgColor, undefined, nextFocusedProjectId);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

  const unarchiveProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      const next = prev.map((project) => (
        project.id === projectId ? { ...project, isArchived: false } : project
      ));
      persist(next, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

  const setFocusedProjectId = useCallback((projectId: string | null) => {
    setFocusedProjectIdState(projectId);
    persist(projects, activeSessionId, theme, terminalBgColor, undefined, projectId);
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const reorderProjects = useCallback((fromIndex: number, toIndex: number) => {
    setProjects((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persist(next, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [activeSessionId, theme, terminalBgColor, persist]);

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

  const addSessionToGroup = useCallback((projectId: string, groupId: string) => {
    let nextSessionId: string | null = null;

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

      nextSessionId = session.id;
      const next = prev.map((p) =>
        p.id === projectId ? { ...p, sessions: [...p.sessions, session] } : p
      );
      setActiveSessionId(session.id);
      markSessionOpened(session.id);
      persist(next, session.id, theme, terminalBgColor, [...openedIdsRef.current]);
      return next;
    });

    if (!nextSessionId) return null;

    setSessionGroups((prev) => {
      const next = prev.map((group) => (
        group.id === groupId
          ? normalizeSessionGroup({
              ...group,
              sessionIds: [...group.sessionIds, nextSessionId!],
            })
          : group
      ));
      sessionGroupsRef.current = next;
      persist(projects, nextSessionId, theme, terminalBgColor, [...openedIdsRef.current]);
      return next;
    });

    return nextSessionId;
  }, [markSessionOpened, persist, projects, theme, terminalBgColor]);

  const removeSession = useCallback((sessionId: string) => {
    closeSession(sessionId);
    // Clean up any groups containing this session
    setSessionGroups((prev) => {
      const next = prev
        .map((g) => normalizeSessionGroup({
          ...g,
          sessionIds: g.sessionIds.filter((id) => id !== sessionId),
          splitGroups: (g.splitGroups || []).map((splitGroup) => ({
            ...splitGroup,
            sessionIds: splitGroup.sessionIds.filter((id) => id !== sessionId),
          })),
        }))
        .filter((g) => g.sessionIds.length > 0);
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

  const reorderGroupSessions = useCallback((projectId: string, sessionIds: string[], toIndex: number) => {
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

  const reorderSessionWithinGroup = useCallback((projectId: string, groupId: string, fromSessionId: string, toSessionId: string, position: 'above' | 'below') => {
    const currentGroup = sessionGroupsRef.current.find((group) => group.id === groupId);
    if (!currentGroup) return;

    const fromIndex = currentGroup.sessionIds.indexOf(fromSessionId);
    const targetIndex = currentGroup.sessionIds.indexOf(toSessionId);
    if (fromIndex === -1 || targetIndex === -1) return;

    const nextGroupSessionIds = [...currentGroup.sessionIds];
    const [movedSessionId] = nextGroupSessionIds.splice(fromIndex, 1);
    let insertAt = position === 'below' ? targetIndex + 1 : targetIndex;
    if (fromIndex < targetIndex) insertAt -= 1;
    insertAt = Math.max(0, Math.min(insertAt, nextGroupSessionIds.length));
    nextGroupSessionIds.splice(insertAt, 0, movedSessionId);

    if (nextGroupSessionIds.every((sessionId, index) => sessionId === currentGroup.sessionIds[index])) return;

    const nextSessionGroups = sessionGroupsRef.current.map((group) => (
      group.id === groupId
        ? normalizeSessionGroup({
            ...group,
            sessionIds: nextGroupSessionIds,
          })
        : group
    ));
    sessionGroupsRef.current = nextSessionGroups;
    setSessionGroups(nextSessionGroups);

    setProjects((prev) => {
      const next = prev.map((project) => {
        if (project.id !== projectId) return project;

        const sessions = [...project.sessions];
        const groupSessionSet = new Set(nextGroupSessionIds);
        const groupIndices = sessions
          .map((session, index) => (groupSessionSet.has(session.id) ? index : -1))
          .filter((index) => index >= 0);
        const orderedGroupSessions = nextGroupSessionIds
          .map((sessionId) => sessions.find((session) => session.id === sessionId))
          .filter(Boolean) as Session[];

        groupIndices.forEach((index, orderIndex) => {
          if (orderedGroupSessions[orderIndex]) {
            sessions[index] = orderedGroupSessions[orderIndex];
          }
        });

        return { ...project, sessions };
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

  const addSessionGroup = useCallback((sessionIds: string[], name?: string) => {
    const normalizedSessionIds = [...new Set(sessionIds)].slice(0, 4);
    if (normalizedSessionIds.length === 0) return null;

    const group: SessionGroup = {
      id: generateId(),
      name: name || 'Group',
      sessionIds: normalizedSessionIds,
      collapsed: false,
      splitGroups: [],
    };
    setSessionGroups((prev) => {
      const filtered = prev
        .map((existing) => normalizeSessionGroup({
          ...existing,
          sessionIds: existing.sessionIds.filter((id) => !normalizedSessionIds.includes(id)),
          splitGroups: (existing.splitGroups || []).map((splitGroup) => ({
            ...splitGroup,
            sessionIds: splitGroup.sessionIds.filter((id) => !normalizedSessionIds.includes(id)),
          })),
        }))
        .filter((existing) => existing.sessionIds.length > 0);
      const next = [...filtered, normalizeSessionGroup(group)];
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
    return group.id;
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const addSessionsToGroup = useCallback((groupId: string, sessionIds: string[]) => {
    const normalizedSessionIds = [...new Set(sessionIds)];
    if (normalizedSessionIds.length === 0) return;

    setSessionGroups((prev) => {
      const strippedGroups = prev
        .map((group) => normalizeSessionGroup({
          ...group,
          sessionIds: group.sessionIds.filter((id) => !normalizedSessionIds.includes(id)),
          splitGroups: (group.splitGroups || []).map((splitGroup) => ({
            ...splitGroup,
            sessionIds: splitGroup.sessionIds.filter((id) => !normalizedSessionIds.includes(id)),
          })),
        }))
        .filter((group) => group.id === groupId || group.sessionIds.length > 0);

      const next = strippedGroups.map((group) => (
        group.id === groupId
          ? normalizeSessionGroup({
              ...group,
              sessionIds: [...group.sessionIds, ...normalizedSessionIds],
            })
          : group
      ));
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const removeSessionsFromGroups = useCallback((sessionIds: string[]) => {
    const normalizedSessionIds = [...new Set(sessionIds)];
    if (normalizedSessionIds.length === 0) return;

    setSessionGroups((prev) => {
      const next = prev
        .map((group) => normalizeSessionGroup({
          ...group,
          sessionIds: group.sessionIds.filter((id) => !normalizedSessionIds.includes(id)),
          splitGroups: (group.splitGroups || []).map((splitGroup) => ({
            ...splitGroup,
            sessionIds: splitGroup.sessionIds.filter((id) => !normalizedSessionIds.includes(id)),
          })),
        }))
        .filter((group) => group.sessionIds.length > 0);
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
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

  const toggleSessionGroupCollapsed = useCallback((groupId: string) => {
    setSessionGroups((prev) => {
      const next = prev.map((g) => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g);
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const createSessionSplitGroup = useCallback((groupId: string, sessionIds: string[]) => {
    const normalizedSessionIds = [...new Set(sessionIds)].slice(0, 4);
    if (normalizedSessionIds.length < 2) return null;

    let nextSplitGroupId: string | null = null;
    setSessionGroups((prev) => {
      const next = prev.map((group) => {
        if (group.id !== groupId) return group;

        const splitGroups = (group.splitGroups || [])
          .map((splitGroup) => ({
            ...splitGroup,
            sessionIds: splitGroup.sessionIds.filter((sessionId) => !normalizedSessionIds.includes(sessionId)),
          }))
          .filter((splitGroup) => splitGroup.sessionIds.length > 1);

        nextSplitGroupId = generateId();
        const nextSplitGroup: SessionSplitGroup = {
          id: nextSplitGroupId,
          name: `Split ${splitGroups.length + 1}`,
          sessionIds: normalizedSessionIds,
          layout: getDefaultGroupLayout(normalizedSessionIds.length),
        };

        return normalizeSessionGroup({
          ...group,
          splitGroups: [...splitGroups, nextSplitGroup],
        });
      });
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
    return nextSplitGroupId;
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const removeSessionSplitGroup = useCallback((groupId: string, splitGroupId: string) => {
    setSessionGroups((prev) => {
      const next = prev.map((group) => (
        group.id === groupId
          ? normalizeSessionGroup({
              ...group,
              splitGroups: (group.splitGroups || []).filter((splitGroup) => splitGroup.id !== splitGroupId),
            })
          : group
      ));
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const renameSessionSplitGroup = useCallback((groupId: string, splitGroupId: string, name: string) => {
    setSessionGroups((prev) => {
      const next = prev.map((group) => (
        group.id === groupId
          ? normalizeSessionGroup({
              ...group,
              splitGroups: (group.splitGroups || []).map((splitGroup) => (
                splitGroup.id === splitGroupId ? { ...splitGroup, name } : splitGroup
              )),
            })
          : group
      ));
      sessionGroupsRef.current = next;
      persist(projects, activeSessionId, theme, terminalBgColor);
      return next;
    });
  }, [projects, activeSessionId, theme, terminalBgColor, persist]);

  const updateSessionSplitGroupLayout = useCallback((groupId: string, splitGroupId: string, layout: LayoutType) => {
    setSessionGroups((prev) => {
      const next = prev.map((group) => (
        group.id === groupId
          ? normalizeSessionGroup({
              ...group,
              splitGroups: (group.splitGroups || []).map((splitGroup) => (
                splitGroup.id === splitGroupId ? { ...splitGroup, layout } : splitGroup
              )),
            })
          : group
      ));
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
    focusedProjectId,
    activeSession,
    activeProject,
    openedSessionIds,
    sidebarWidth,
    setSidebarWidth,
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
    servingCommands,
    setServingCommands,
    addProject,
    removeProject,
    archiveProject,
    unarchiveProject,
    setFocusedProjectId,
    reorderProjects,
    addSession,
    addSessionToGroup,
    removeSession,
    selectSession,
    renameSession,
    reorderSessions,
    reorderGroupSessions,
    reorderSessionWithinGroup,
    setSessionLayout,
    updateSessionLastCommand,
    sessionGroups,
    addSessionGroup,
    addSessionsToGroup,
    removeSessionsFromGroups,
    removeSessionGroup,
    renameSessionGroup,
    updateGroupColor,
    toggleSessionGroupCollapsed,
    createSessionSplitGroup,
    removeSessionSplitGroup,
    renameSessionSplitGroup,
    updateSessionSplitGroupLayout,
  };
}
