import { forwardRef } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { TerminalPane } from './TerminalPane';
import type { TerminalPaneHandle } from './TerminalPane';
import type { LayoutType } from '../types';

interface TerminalAreaProps {
  layout: LayoutType;
  cwd?: string;
  sessionId: string;
  onTerminalData?: (data: string) => void;
  onPtyOutput?: (data: string) => void;
  bgColor?: string;
  isActive?: boolean;
  shellPath?: string;
  shellArgs?: string[];
  autoCopy?: boolean;
  rightClickPaste?: boolean;
}

export const TerminalArea = forwardRef<TerminalPaneHandle, TerminalAreaProps>(function TerminalArea({ layout, cwd, sessionId, onTerminalData, onPtyOutput, bgColor, isActive, shellPath, shellArgs, autoCopy, rightClickPaste }, ref) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <LayoutRenderer ref={ref} layout={layout} cwd={cwd} onData={onTerminalData} onPtyOutput={onPtyOutput} bgColor={bgColor} isActive={isActive} shellPath={shellPath} shellArgs={shellArgs} autoCopy={autoCopy} rightClickPaste={rightClickPaste} />
    </div>
  );
});

interface LayoutRendererProps {
  layout: LayoutType;
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

const LayoutRenderer = forwardRef<TerminalPaneHandle, LayoutRendererProps>(function LayoutRenderer({ layout, cwd, onData, onPtyOutput, bgColor, isActive, shellPath, shellArgs, autoCopy, rightClickPaste }, ref) {
  const cp = { autoCopy, rightClickPaste };
  switch (layout) {
    case 'single':
      return <TerminalPane ref={ref} cwd={cwd} onData={onData} onPtyOutput={onPtyOutput} bgColor={bgColor} isActive={isActive} shellPath={shellPath} shellArgs={shellArgs} {...cp} />;

    case 'hsplit':
      return (
        <Allotment vertical>
          <Allotment.Pane><TerminalPane ref={ref} cwd={cwd} onData={onData} onPtyOutput={onPtyOutput} bgColor={bgColor} isActive={isActive} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
          <Allotment.Pane><TerminalPane cwd={cwd} bgColor={bgColor} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
        </Allotment>
      );

    case 'vsplit':
      return (
        <Allotment>
          <Allotment.Pane><TerminalPane ref={ref} cwd={cwd} onData={onData} onPtyOutput={onPtyOutput} bgColor={bgColor} isActive={isActive} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
          <Allotment.Pane><TerminalPane cwd={cwd} bgColor={bgColor} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
        </Allotment>
      );

    case 'three':
      return (
        <Allotment>
          <Allotment.Pane><TerminalPane ref={ref} cwd={cwd} onData={onData} onPtyOutput={onPtyOutput} bgColor={bgColor} isActive={isActive} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
          <Allotment.Pane>
            <Allotment vertical>
              <Allotment.Pane><TerminalPane cwd={cwd} bgColor={bgColor} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
              <Allotment.Pane><TerminalPane cwd={cwd} bgColor={bgColor} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      );

    case 'grid':
      return (
        <Allotment vertical>
          <Allotment.Pane>
            <Allotment>
              <Allotment.Pane><TerminalPane ref={ref} cwd={cwd} onData={onData} onPtyOutput={onPtyOutput} bgColor={bgColor} isActive={isActive} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
              <Allotment.Pane><TerminalPane cwd={cwd} bgColor={bgColor} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
          <Allotment.Pane>
            <Allotment>
              <Allotment.Pane><TerminalPane cwd={cwd} bgColor={bgColor} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
              <Allotment.Pane><TerminalPane cwd={cwd} bgColor={bgColor} shellPath={shellPath} shellArgs={shellArgs} {...cp} /></Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      );
  }
});
