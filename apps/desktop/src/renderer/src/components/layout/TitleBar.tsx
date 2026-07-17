import { useEffect, useState } from 'react';
import { Sparkles, WindowMaximize, WindowMinimize, X } from '@/components/icons';
import { cn } from '@/lib/utils';

function TrafficLight({
  color,
  icon: Icon,
  onClick,
  title,
}: {
  color: string;
  icon: typeof X;
  onClick: () => void;
  title: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'group/dot flex h-3.5 w-3.5 items-center justify-center rounded-full transition-transform hover:scale-110 [-webkit-app-region:no-drag]',
        color,
      )}
    >
      <Icon className="h-2 w-2 text-black/60 opacity-0 transition-opacity group-hover/dot:opacity-100" />
    </button>
  );
}

function MacTrafficLights({ onMinimize, onMaximizeToggle, onClose }: WindowControlsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <TrafficLight color="bg-[#ff5f57]" icon={X} title="Close" onClick={onClose} />
      <TrafficLight color="bg-[#febc2e]" icon={WindowMinimize} title="Minimize" onClick={onMinimize} />
      <TrafficLight color="bg-[#28c840]" icon={WindowMaximize} title="Maximize" onClick={onMaximizeToggle} />
    </div>
  );
}

interface WindowControlsProps {
  isMaximized: boolean;
  onMinimize: () => void;
  onMaximizeToggle: () => void;
  onClose: () => void;
}

// Windows 11 style caption buttons: flat 46px rectangles, right-aligned,
// rendered with the system's Segoe Fluent Icons glyphs so they look native.
// Hover follows the OS: subtle wash for minimize/maximize, red for close.
const GLYPH = { minimize: '\uE921', maximize: '\uE922', restore: '\uE923', close: '\uE8BB' };

function NativeCaptionButtons({
  isMaximized,
  onMinimize,
  onMaximizeToggle,
  onClose,
}: WindowControlsProps): React.JSX.Element {
  return (
    <div className="flex h-11 items-stretch [-webkit-app-region:no-drag]">
      <button
        type="button"
        title="Minimize"
        onClick={onMinimize}
        className="flex w-[46px] items-center justify-center text-foreground/80 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
      >
        <span className="caption-glyph" aria-hidden="true">
          {GLYPH.minimize}
        </span>
      </button>
      <button
        type="button"
        title={isMaximized ? 'Restore' : 'Maximize'}
        onClick={onMaximizeToggle}
        className="flex w-[46px] items-center justify-center text-foreground/80 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
      >
        <span className="caption-glyph" aria-hidden="true">
          {isMaximized ? GLYPH.restore : GLYPH.maximize}
        </span>
      </button>
      <button
        type="button"
        title="Close"
        onClick={onClose}
        className="flex w-[46px] items-center justify-center text-foreground/80 transition-colors hover:bg-[#c42b1c] hover:text-white"
      >
        <span className="caption-glyph" aria-hidden="true">
          {GLYPH.close}
        </span>
      </button>
    </div>
  );
}

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = window.agentmat.platform === 'darwin';

  useEffect(() => {
    window.agentmat.window.isMaximized().then(setIsMaximized);
    return window.agentmat.window.onMaximizedChange(setIsMaximized);
  }, []);

  const controlProps: WindowControlsProps = {
    isMaximized,
    onMinimize: () => void window.agentmat.window.minimize(),
    onMaximizeToggle: () => void window.agentmat.window.maximizeToggle(),
    onClose: () => void window.agentmat.window.close(),
  };

  return (
    <div
      className="relative flex h-11 shrink-0 items-center justify-between border-b border-border pl-4 [-webkit-app-region:drag]"
      onDoubleClick={() => void window.agentmat.window.maximizeToggle()}
    >
      <div className="flex items-center gap-3">
        {isMac && <MacTrafficLights {...controlProps} />}
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.5)]">
            <Sparkles className="h-3.5 w-3.5 text-black/80" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">AgentMate</span>
        </div>
      </div>

      {!isMac && <NativeCaptionButtons {...controlProps} />}
    </div>
  );
}
