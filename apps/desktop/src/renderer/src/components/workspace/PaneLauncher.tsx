import type { Project } from '@agentmat/core';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CliLogo } from '@/components/cliLogos';
import { Download, Sparkles, TerminalSquare } from '@/components/icons';
import { ProjectIcon } from '@/components/projects/ProjectIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLauncherStore, usePromptDialogStore } from '@/lib/workspace/commands';
import { launchAgentTab, launchShellTab, shellOptions } from '@/lib/workspace/launch';
import { useCliStore } from '@/stores/cliStore';
import { useAgentChoices } from './useAgentChoices';

export interface PaneLauncherProps {
  project: Project;
  groupId: string;
  /** The whole workspace is empty, so this is the page's welcome, not just one spare pane. */
  hero: boolean;
  /** This pane has keyboard focus, so digit keys launch from it. */
  focused: boolean;
}

/** What an empty pane shows: big, obvious ways to start an agent or a shell. */
export function PaneLauncher({
  project,
  groupId,
  hero,
  focused,
}: PaneLauncherProps): React.JSX.Element {
  const agents = useAgentChoices(project);
  const shells = shellOptions();
  const menuOpen = useLauncherStore((s) => s.openForGroupId !== null);
  const hasSavedArgs = useCliStore((s) => Object.keys(s.cliArgs).length > 0);
  const visibleAgents = useMemo(
    () => agents.installed.slice(0, hero ? 9 : 6),
    [agents.installed, hero],
  );

  useEffect(() => {
    if (!focused || menuOpen) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const digit = /^Digit([1-9])$/.exec(event.code);
      const choice = digit ? visibleAgents[Number(digit[1]) - 1] : undefined;
      if (!choice) return;
      event.preventDefault();
      launchAgentTab(project, choice.cli.id, groupId, { skipSavedArgs: event.altKey });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused, menuOpen, visibleAgents, project, groupId]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto p-6">
      <div className={cn('flex w-full flex-col items-center', hero ? 'max-w-2xl' : 'max-w-md')}>
        {hero ? (
          <div className="mb-7 flex flex-col items-center text-center">
            <ProjectIcon
              iconDataUrl={project.iconDataUrl}
              bgColor={project.iconBgColor}
              iconColor={project.iconColor}
              className="h-14 w-14 rounded-2xl shadow-[0_0_40px_-12px_hsl(var(--primary)/0.6)]"
              glyphClassName="h-6 w-6"
            />
            <h2 className="mt-4 text-xl font-semibold tracking-tight">{project.name}</h2>
            <p className="mt-1 max-w-md truncate font-mono text-xs text-muted-foreground">
              {project.folderPath}
            </p>
          </div>
        ) : null}

        <p className="mb-3 flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>{hero ? 'Start an agent' : 'Open in this pane'}</span>
          {hasSavedArgs ? (
            <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
              Alt+click: skip saved args
            </span>
          ) : null}
        </p>

        {agents.loading ? (
          <div className={cn('grid w-full gap-2', hero ? 'grid-cols-3' : 'grid-cols-2')}>
            {Array.from({ length: hero ? 6 : 4 }, (_, i) => (
              <Skeleton key={i} className={cn('rounded-xl', hero ? 'h-24' : 'h-14')} />
            ))}
          </div>
        ) : visibleAgents.length === 0 ? (
          <div className="glass w-full rounded-xl p-5 text-center">
            <p className="text-sm font-medium">No agent CLIs installed yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Install Claude Code, Codex, Gemini or another agent to run it here.
            </p>
            <Link
              to="/cli-manager"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Download className="h-3 w-3" /> Open the CLI manager
            </Link>
          </div>
        ) : (
          <div
            className={cn(
              'grid w-full gap-2',
              hero ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 min-[420px]:grid-cols-2',
            )}
          >
            {visibleAgents.map((choice, index) => (
              <button
                key={choice.cli.id}
                type="button"
                onClick={(event) =>
                  launchAgentTab(project, choice.cli.id, groupId, {
                    skipSavedArgs: event.altKey,
                  })
                }
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl border text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.06] motion-reduce:hover:translate-y-0',
                  hero ? 'flex-col items-start gap-3 p-4' : 'px-3 py-2.5',
                  choice.isDefault
                    ? 'border-primary/35 bg-primary/[0.05] shadow-[0_0_24px_-14px_hsl(var(--primary)/0.8)]'
                    : 'border-border/70 bg-card/40',
                )}
              >
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05]',
                    hero ? 'h-10 w-10' : 'h-7 w-7',
                  )}
                >
                  <CliLogo cliId={choice.cli.id} className={hero ? 'h-5 w-5' : 'h-4 w-4'} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{choice.cli.name}</span>
                  {hero ? (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {choice.isDefault ? 'Project default' : choice.cli.executableNames[0]}
                    </span>
                  ) : null}
                </span>
                <kbd
                  className={cn(
                    'rounded border border-border/80 bg-foreground/[0.04] px-1.5 font-mono text-[10px] leading-4 text-muted-foreground transition-opacity',
                    hero ? 'absolute right-3 top-3' : '',
                    focused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  {index + 1}
                </kbd>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => usePromptDialogStore.getState().open(project.id, groupId)}
          className="group mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] px-3.5 py-2.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Build a prompt first</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Turn a rough request into a prompt, then open it in an agent on the suggested model
            </span>
          </span>
        </button>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">or open a shell</span>
          {shells.map((option) => (
            <button
              key={option.shell}
              type="button"
              onClick={() => launchShellTab(project, option.shell, groupId)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TerminalSquare className="h-3 w-3" />
              {option.label}
            </button>
          ))}
        </div>

        {hero && agents.missing.length > 0 && agents.installed.length > 0 ? (
          <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground/70">
            <span>Not installed:</span>
            <span className="flex items-center gap-1">
              {agents.missing.slice(0, 8).map((choice) => (
                <SimpleTooltip key={choice.cli.id} label={`Install ${choice.cli.name}`}>
                  <Link
                    to="/cli-manager"
                    className="flex h-5 w-5 items-center justify-center rounded opacity-50 grayscale transition hover:opacity-100 hover:grayscale-0"
                  >
                    <CliLogo cliId={choice.cli.id} className="h-3.5 w-3.5" />
                  </Link>
                </SimpleTooltip>
              ))}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
