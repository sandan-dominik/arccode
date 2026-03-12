import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useTerminal } from '../hooks/useTerminal';

interface TerminalPaneProps {
  cwd?: string;
  onData?: (data: string) => void;
  onPtyOutput?: (data: string) => void;
  bgColor?: string;
  isActive?: boolean;
  shellPath?: string;
  shellArgs?: string[];
  autoCopy?: boolean;
  rightClickPaste?: boolean;
}

export interface TerminalPaneHandle {
  write: (data: string) => void;
  focus: () => void;
}

export const TerminalPane = forwardRef<TerminalPaneHandle, TerminalPaneProps>(function TerminalPane({ cwd, onData, onPtyOutput, bgColor, isActive, shellPath, shellArgs, autoCopy, rightClickPaste }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { focus, write } = useTerminal(containerRef, { cwd, onData, onPtyOutput, bgColor, shellPath, shellArgs, autoCopy, rightClickPaste });

  useImperativeHandle(ref, () => ({ write, focus }), [write, focus]);

  useEffect(() => {
    if (isActive) focus();
  }, [isActive, focus]);

  return <div ref={containerRef} className="terminal-container" />;
});
