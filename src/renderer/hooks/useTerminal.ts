import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

interface UseTerminalOptions {
  cwd?: string;
  onData?: (data: string) => void;
  onPtyOutput?: (data: string) => void;
  bgColor?: string;
  shellPath?: string;
  shellArgs?: string[];
  autoCopy?: boolean;
  rightClickPaste?: boolean;
}

export function useTerminal(containerRef: React.RefObject<HTMLDivElement | null>, options: UseTerminalOptions = {}) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fit = useCallback(() => {
    if (fitAddonRef.current && termRef.current && containerRef.current) {
      try {
        fitAddonRef.current.fit();
        if (ptyIdRef.current) {
          window.electronAPI.pty.resize(
            ptyIdRef.current,
            termRef.current.cols,
            termRef.current.rows
          );
        }
      } catch {
        // container may not be visible yet
      }
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: options.bgColor || '#171717',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        selectionBackground: '#333333',
        black: '#222222',
        red: '#e55561',
        green: '#7ec699',
        yellow: '#e2b86b',
        blue: '#6cb6ff',
        magenta: '#c678dd',
        cyan: '#56d4dd',
        white: '#abb2bf',
        brightBlack: '#555555',
        brightRed: '#e55561',
        brightGreen: '#7ec699',
        brightYellow: '#e2b86b',
        brightBlue: '#6cb6ff',
        brightMagenta: '#c678dd',
        brightCyan: '#56d4dd',
        brightWhite: '#e0e0e0',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(container);

    // Set container bg to match terminal
    container.style.background = options.bgColor || '#171717';

    // Try WebGL, fall back silently
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // WebGL not available
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit after a frame
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Spawn PTY
    let disposed = false;
    window.electronAPI.pty.create(options.cwd, options.shellPath || undefined, options.shellArgs?.length ? options.shellArgs : undefined).then((id) => {
      if (disposed) {
        window.electronAPI.pty.kill(id);
        return;
      }
      ptyIdRef.current = id;

      // Resize to current terminal size
      window.electronAPI.pty.resize(id, term.cols, term.rows);
    });

    // Listen for PTY data
    let resizeSuppressUntil = 0;
    const removeDataListener = window.electronAPI.pty.onData((id, data) => {
      if (id === ptyIdRef.current) {
        term.write(data);
        if (Date.now() > resizeSuppressUntil) {
          optionsRef.current.onPtyOutput?.(data);
        }
      }
    });

    // Auto-copy on selection
    const selectionDisposable = term.onSelectionChange(() => {
      if (optionsRef.current.autoCopy) {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
      }
    });

    // Right-click context menu or direct paste
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      if (optionsRef.current.rightClickPaste) {
        // Direct paste, skip context menu
        navigator.clipboard.readText().then((text) => {
          if (ptyIdRef.current && text) window.electronAPI.pty.write(ptyIdRef.current, text);
        });
        return;
      }

      const selection = term.getSelection();
      const menu = document.createElement('div');
      menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;padding:4px 0;z-index:1000;min-width:120px;box-shadow:0 4px 12px rgba(0,0,0,0.3)`;
      const makeItem = (label: string, action: () => void, disabled = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.disabled = disabled;
        btn.style.cssText = `display:block;width:100%;text-align:left;padding:6px 12px;font-size:12px;color:${disabled ? 'var(--text-muted)' : 'var(--text-primary)'};background:none;border:none;cursor:${disabled ? 'default' : 'pointer'};font-family:inherit`;
        if (!disabled) {
          btn.onmouseenter = () => btn.style.background = 'var(--bg-hover)';
          btn.onmouseleave = () => btn.style.background = 'none';
          btn.onclick = () => { action(); menu.remove(); };
        }
        return btn;
      };
      menu.appendChild(makeItem('Copy', () => {
        navigator.clipboard.writeText(selection);
        term.clearSelection();
      }, !selection));
      menu.appendChild(makeItem('Paste', () => {
        navigator.clipboard.readText().then((text) => {
          if (ptyIdRef.current && text) window.electronAPI.pty.write(ptyIdRef.current, text);
        });
      }));
      document.body.appendChild(menu);
      const dismiss = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('mousedown', dismiss); }
      };
      setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
    };
    container.addEventListener('contextmenu', handleContextMenu);

    // Send user input to PTY
    const inputDisposable = term.onData((data) => {
      if (ptyIdRef.current) {
        window.electronAPI.pty.write(ptyIdRef.current, data);
        // Capture for last-command preview
        optionsRef.current.onData?.(data);
      }
    });

    // ResizeObserver with debounce + opacity mask to hide resize flash
    let resizeTimer: ReturnType<typeof setTimeout>;
    let lastWidth = container.offsetWidth;
    let lastHeight = container.offsetHeight;
    const observer = new ResizeObserver(() => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      // Becoming visible (was hidden/zero-sized)
      const becomingVisible = (lastWidth === 0 || lastHeight === 0) && w > 0 && h > 0;
      lastWidth = w;
      lastHeight = h;

      if (becomingVisible) {
        // Hide while we re-fit
        container.style.opacity = '0';
      }

      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          fitAddon.fit();
          if (ptyIdRef.current) {
            window.electronAPI.pty.resize(ptyIdRef.current, term.cols, term.rows);
            resizeSuppressUntil = Date.now() + 2000;
          }
        } catch {
          // ignore
        }
        // Reveal after fit
        if (becomingVisible) {
          requestAnimationFrame(() => {
            container.style.opacity = '1';
          });
        }
      }, 16);
    });
    observer.observe(container);

    cleanupRef.current = () => {
      disposed = true;
      observer.disconnect();
      clearTimeout(resizeTimer);
      removeDataListener();
      inputDisposable.dispose();
      selectionDisposable.dispose();
      container.removeEventListener('contextmenu', handleContextMenu);
      if (ptyIdRef.current) {
        window.electronAPI.pty.kill(ptyIdRef.current);
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      ptyIdRef.current = null;
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []); // Mount once

  // Update terminal background when bgColor changes
  useEffect(() => {
    if (termRef.current && options.bgColor) {
      termRef.current.options.theme = {
        ...termRef.current.options.theme,
        background: options.bgColor,
      };
      if (containerRef.current) {
        containerRef.current.style.background = options.bgColor;
      }
    }
  }, [options.bgColor, containerRef]);

  const focus = useCallback(() => {
    termRef.current?.focus();
  }, []);

  const write = useCallback((data: string) => {
    if (ptyIdRef.current) {
      window.electronAPI.pty.write(ptyIdRef.current, data);
    }
  }, []);

  return { fit, focus, write };
}
