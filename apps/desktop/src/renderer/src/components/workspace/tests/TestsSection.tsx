import {
  aggregateStatuses,
  attachResults,
  buildFixTestsPrompt,
  countResults,
  formatTestIssue,
  type Project,
  TEST_FRAMEWORKS,
  type TestNode,
  type TestResult,
  type TestRunError,
  type TestStatus,
  type TestTarget,
} from '@agentmat/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Ban,
  ChevronRight,
  CircleCheck,
  CircleX,
  Copy,
  FileCode,
  Flask,
  Play,
  RefreshCw,
  Spinner,
  StopCircle,
  TriangleAlert,
  Wand2,
} from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import {
  ensureTestRunSubscription,
  failedResults,
  type ProjectTestRun,
  useTestsStore,
} from '@/stores/testsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { type FixSource, FixWithAiDialog } from '../FixWithAiDialog';
import { PanelIconButton } from '../git/PanelTabs';

type Filter = 'all' | 'failed' | 'passed' | 'skipped';

const EMPTY_RUN: ProjectTestRun = { summary: null, results: {}, output: '' };
/** One look for every button in the run summary, so none of them wraps or shouts. */
const ACTION_BUTTON =
  'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground';

/** Past this many tests, files start folded so the list stays scannable. */
const FOLD_FILES_OVER = 300;

/**
 * The run without its output text. Output changes on nearly every event, and only the output pane
 * reads it, so the tree and the buttons must not re-render for it.
 */
function useProjectRun(projectId: string): Omit<ProjectTestRun, 'output'> {
  const summary = useTestsStore((s) => s.runs[projectId]?.summary) ?? EMPTY_RUN.summary;
  const results = useTestsStore((s) => s.runs[projectId]?.results) ?? EMPTY_RUN.results;
  return useMemo(() => ({ summary, results }), [summary, results]);
}

function useHasOutput(projectId: string): boolean {
  return useTestsStore((s) => Boolean(s.runs[projectId]?.output));
}

function OutputPane({ projectId }: { projectId: string }) {
  const output = useTestsStore((s) => s.runs[projectId]?.output ?? '');
  if (!output) return null;
  return (
    <pre
      aria-label="Test output"
      className="max-h-[40%] shrink-0 overflow-auto whitespace-pre-wrap break-words border-t border-border/60 bg-background/60 px-3 py-2 font-mono text-[10.5px] leading-relaxed text-muted-foreground"
    >
      {output}
    </pre>
  );
}

/** Failed tests and failed files in the project's latest run, for the tab badge. */
export function useTestsFailedCount(projectId: string): number {
  return useTestsStore((s) => failedResults(s.runs[projectId]).length);
}

function useDiscovery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.testsDiscovery(projectId),
    queryFn: () => window.agentmat.tests.discover(projectId),
    staleTime: 30_000,
    meta: { silentLoading: true },
  });
}

async function startRun(projectId: string, targets: TestTarget[]): Promise<void> {
  try {
    await window.agentmat.tests.run(projectId, targets);
  } catch (error) {
    toast.error('Could not run tests', {
      description:
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : String(error),
    });
  }
}

function targetFor(node: TestNode): TestTarget {
  if (node.kind === 'project') return { testProjectId: node.testProjectId };
  if (node.kind === 'file') return { testProjectId: node.testProjectId, files: [node.file ?? ''] };
  return { testProjectId: node.testProjectId, tests: [{ file: node.file ?? '', path: node.path }] };
}

/** Groups failed tests into one target per test project. */
function failedTargets(results: TestResult[]): TestTarget[] {
  const byProject = new Map<string, TestTarget>();
  for (const result of results) {
    const target = byProject.get(result.testProjectId) ?? { testProjectId: result.testProjectId };
    if (result.path.length === 0) {
      if (result.file) target.files = [...(target.files ?? []), result.file];
    } else if (result.file) {
      target.tests = [...(target.tests ?? []), { file: result.file, path: result.path }];
    }
    byProject.set(result.testProjectId, target);
  }
  return [...byProject.values()];
}

function absolutePath(folderPath: string, file: string): string {
  const sep = folderPath.includes('\\') ? '\\' : '/';
  return `${folderPath.replace(/[\\/]+$/, '')}${sep}${file.split('/').join(sep)}`;
}

function openInEditor(project: Project, file: string): void {
  useWorkspaceStore
    .getState()
    .openFile(project.id, absolutePath(project.folderPath, file), { pin: true });
}

const frameworkLabelOf = (testProjectId: string): string | undefined => {
  const framework = testProjectId.split(':')[0] as keyof typeof TEST_FRAMEWORKS;
  return TEST_FRAMEWORKS[framework]?.label;
};

/** Buttons for the Tests tab in the panel's strip. */
export function TestsTabActions({ project }: { project: Project }): React.JSX.Element {
  const queryClient = useQueryClient();
  const run = useProjectRun(project.id);
  const running = run.summary?.running === true;

  useEffect(() => ensureTestRunSubscription(), []);

  return (
    <>
      {running ? (
        <PanelIconButton
          label="Stop tests"
          onClick={() => void window.agentmat.tests.cancel(project.id)}
        >
          <StopCircle className="h-2.5 w-2.5" />
        </PanelIconButton>
      ) : (
        <PanelIconButton label="Run all tests" onClick={() => void startRun(project.id, [])}>
          <Play className="h-2.5 w-2.5" />
        </PanelIconButton>
      )}
      <PanelIconButton
        label="Refresh tests"
        onClick={() =>
          void queryClient.invalidateQueries({ queryKey: queryKeys.testsDiscovery(project.id) })
        }
      >
        <RefreshCw className="h-2.5 w-2.5" />
      </PanelIconButton>
    </>
  );
}

function StatusIcon({ status }: { status: TestStatus | undefined }): React.JSX.Element {
  if (status === 'running' || status === 'queued') {
    return (
      <span
        role="img"
        aria-label="Running"
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-amber-500"
      >
        <Spinner className="h-3 w-3 animate-spin" />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        role="img"
        aria-label="Failed"
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-destructive"
      >
        <CircleX className="h-3 w-3" />
      </span>
    );
  }
  if (status === 'passed') {
    return (
      <span
        role="img"
        aria-label="Passed"
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400"
      >
        <CircleCheck className="h-3 w-3" />
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span
        role="img"
        aria-label="Skipped"
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground"
      >
        <Ban className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="Not run"
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center"
    >
      <span className="h-2 w-2 rounded-full border border-muted-foreground/40" />
    </span>
  );
}

function RowButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label} side="left">
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 group-hover/test:opacity-100"
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}

function formatDuration(ms: number | undefined): string | null {
  if (ms === undefined) return null;
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

interface VisibleRow {
  node: TestNode;
  depth: number;
}

function nodeMatches(node: TestNode, query: string): boolean {
  return node.name.toLowerCase().includes(query);
}

/** The rows to draw, in order, after folding, the status filter and the search are applied. */
function visibleRows(
  tree: TestNode[],
  statuses: Map<string, TestStatus>,
  own: Record<string, TestResult>,
  filter: Filter,
  query: string,
  collapsed: Set<string>,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const passesFilter = (node: TestNode): boolean => {
    if (filter === 'all') return true;
    const status =
      own[node.id]?.status ?? (node.kind === 'test' ? statuses.get(node.id) : undefined);
    if (status === filter) return node.kind === 'test' || own[node.id] !== undefined;
    return node.children.some(passesFilter);
  };
  const passesSearch = (node: TestNode): boolean =>
    !query || nodeMatches(node, query) || node.children.some(passesSearch);

  const visit = (node: TestNode, depth: number, ancestorMatched: boolean): void => {
    const matched = ancestorMatched || !query || nodeMatches(node, query);
    if (!passesFilter(node)) return;
    if (!matched && !passesSearch(node)) return;
    rows.push({ node, depth });
    if (collapsed.has(node.id) && !query && filter === 'all') return;
    for (const child of node.children) visit(child, depth + 1, matched && Boolean(query));
  };
  for (const project of tree) visit(project, 0, false);
  return rows;
}

/** The project's tests: discover, run, follow results, and act on failures. */
export function TestsSection({ project }: { project: Project }): React.JSX.Element {
  const discovery = useDiscovery(project.id);
  const run = useProjectRun(project.id);
  const hasOutput = useHasOutput(project.id);
  const hydrate = useTestsStore((s) => s.hydrate);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hiddenDetails, setHiddenDetails] = useState<Set<string>>(new Set());
  const [showOutput, setShowOutput] = useState(false);
  const [fixing, setFixing] = useState<{
    title: string;
    description?: string;
    jobKey: string;
    source: FixSource;
  } | null>(null);

  useEffect(() => ensureTestRunSubscription(), []);

  useEffect(() => {
    let cancelled = false;
    void window.agentmat.tests
      .lastRun(project.id)
      .then((snapshot) => {
        if (!cancelled && snapshot) hydrate(project.id, snapshot);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.id, hydrate]);

  const results = useMemo(() => Object.values(run.results), [run.results]);
  const tree = useMemo(
    () => (discovery.data ? attachResults(discovery.data.tree, results) : []),
    [discovery.data, results],
  );
  const statuses = useMemo(() => aggregateStatuses(tree, results), [tree, results]);

  // Big suites start with files folded; the choice is made once per discovery.
  useEffect(() => {
    if (!discovery.data) return;
    let tests = 0;
    const files: string[] = [];
    const count = (node: TestNode): void => {
      if (node.kind === 'test') tests += 1;
      if (node.kind === 'file') files.push(node.id);
      node.children.forEach(count);
    };
    discovery.data.tree.forEach(count);
    setCollapsed(tests > FOLD_FILES_OVER ? new Set(files) : new Set());
  }, [discovery.data]);

  if (discovery.isPending) {
    return (
      <div aria-label="Finding tests" aria-busy="true" className="space-y-2 p-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{ paddingLeft: `${(i % 3) * 12}px` }}
          >
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-3 flex-1 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const notice = (
    title: string,
    body: React.ReactNode,
    action?: { label: string; run: () => void },
  ) => (
    <div className="flex flex-col items-center gap-1.5 px-5 py-5 text-center">
      <Flask className="h-4 w-4 text-muted-foreground" />
      <p className="text-xs font-medium">{title}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{body}</p>
      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="mt-1 text-[11px] font-medium text-primary hover:underline"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );

  if (discovery.isError) {
    return notice('Could not read the tests', discovery.error.message, {
      label: 'Try again',
      run: () => void discovery.refetch(),
    });
  }
  if (discovery.data.projects.length === 0) {
    return notice(
      'No tests found',
      'AgentMate looks for Vitest, Jest, Playwright, Mocha, pytest, unittest, Go, Cargo, .NET, Dart, Flutter, PHPUnit, RSpec, Gradle and Maven projects.',
      { label: 'Look again', run: () => void discovery.refetch() },
    );
  }

  const summary = run.summary;
  const running = summary?.running === true;
  const counts = countResults(results);
  // Queued tests have no result of their own yet, so count them straight from the run.
  const inFlight = results.filter(
    (result) => result.status === 'queued' || result.status === 'running',
  ).length;
  const failures = results.filter((result) => result.status === 'failed');
  const failedTests = failures.filter((result) => result.path.length > 0);
  const labelOf = (testProjectId: string): string =>
    discovery.data.projects.find((entry) => entry.id === testProjectId)?.label ?? testProjectId;
  const rows = visibleRows(
    tree,
    statuses,
    run.results,
    filter,
    query.trim().toLowerCase(),
    collapsed,
  );

  const toggle = (id: string, set: React.Dispatch<React.SetStateAction<Set<string>>>): void =>
    set((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function copyIssue(result: TestResult): Promise<void> {
    const command = result.file
      ? await window.agentmat.tests
          .command(project.id, {
            testProjectId: result.testProjectId,
            ...(result.path.length > 0
              ? { tests: [{ file: result.file, path: result.path }] }
              : { files: [result.file] }),
          })
          .catch(() => null)
      : null;
    const issue = formatTestIssue(result, {
      frameworkLabel: frameworkLabelOf(result.testProjectId),
      command: command ?? undefined,
    });
    try {
      await navigator.clipboard.writeText(issue);
      toast.success('Issue copied');
    } catch (error) {
      // The browser clipboard only works while the window has focus; say so rather than go quiet.
      toast.error('Could not copy the issue', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Opens the dialog straight away and fills the prompt once the rerun command is known. */
  function fixResults(list: TestResult[], errors: TestRunError[]): void {
    const projectIds = [
      ...new Set([
        ...list.map((entry) => entry.testProjectId),
        ...errors.map((entry) => entry.testProjectId),
      ]),
    ];
    const single = projectIds.length === 1 ? projectIds[0] : undefined;
    const frameworkLabel = single ? frameworkLabelOf(single) : undefined;
    const title =
      list.length === 1
        ? `Fix ${list[0].path.join(' > ') || list[0].file} with AI`
        : list.length > 1
          ? `Fix ${list.length} failing tests with AI`
          : `Fix the ${single ? labelOf(single) : ''} test run with AI`.replace('  ', ' ');
    const jobKey = `tests-fix:${project.id}:${summary?.runId ?? 'none'}:${list.map((entry) => entry.id).join('|') || errors.map((entry) => entry.testProjectId).join('|')}`;
    const build = (command?: string) =>
      buildFixTestsPrompt({ failures: list, errors, frameworkLabel, command });
    const description = [single ? labelOf(single) : null, list[0]?.file]
      .filter(Boolean)
      .join(' · ');
    setFixing({
      title,
      description,
      jobKey,
      source: { prompt: null, loadingLabel: 'Collecting the failure output…' },
    });

    const target = single && list.length > 0 ? failedTargets(list)[0] : undefined;
    const commandPromise = target
      ? window.agentmat.tests.command(project.id, target).catch(() => null)
      : Promise.resolve(errors[0]?.command ?? null);
    void commandPromise.then((command) =>
      setFixing((current) =>
        current && current.jobKey === jobKey
          ? {
              ...current,
              source: { prompt: build(list.length > 0 ? (command ?? undefined) : undefined) },
            }
          : current,
      ),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {summary ? (
        <div className="shrink-0 border-b border-border/60 px-3 py-1.5">
          {/* Counts first, buttons under them: the panel is narrow and one row makes both wrap. */}
          <div
            role="group"
            aria-label="Test run counts"
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
          >
            {running ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Spinner className="h-3 w-3 animate-spin text-amber-500 motion-reduce:animate-none" />
                {inFlight > 0
                  ? `Running ${inFlight} ${inFlight === 1 ? 'test' : 'tests'}…`
                  : 'Running tests…'}
              </span>
            ) : (
              <>
                {counts.failed > 0 ? (
                  <span className="font-semibold text-destructive">{counts.failed} failed</span>
                ) : null}
                {counts.passed > 0 ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {counts.passed} passed
                  </span>
                ) : null}
                {counts.skipped > 0 ? (
                  <span className="text-muted-foreground">{counts.skipped} skipped</span>
                ) : null}
                {summary.cancelled ? <span className="text-muted-foreground">Stopped</span> : null}
                {summary.finishedAt ? (
                  <span className="text-muted-foreground tabular-nums">
                    {formatDuration(summary.finishedAt - summary.startedAt)}
                  </span>
                ) : null}
              </>
            )}
          </div>
          {!running && (failures.length > 0 || hasOutput) ? (
            <div
              role="group"
              aria-label="Test run actions"
              className="mt-1 flex flex-wrap items-center gap-1"
            >
              {failures.length > 0 ? (
                <button
                  type="button"
                  aria-label="Run failed tests"
                  onClick={() => void startRun(project.id, failedTargets(failures))}
                  className={ACTION_BUTTON}
                >
                  <Play className="h-2.5 w-2.5 shrink-0" />
                  Run failed
                </button>
              ) : null}
              {failedTests.length > 1 ? (
                <button
                  type="button"
                  aria-label="Fix all failures with AI"
                  onClick={() => fixResults(failedTests, [])}
                  className={cn(ACTION_BUTTON, 'bg-primary/10 text-primary hover:bg-primary/16')}
                >
                  <Wand2 className="h-2.5 w-2.5 shrink-0" />
                  Fix all with AI
                </button>
              ) : null}
              {hasOutput ? (
                <button
                  type="button"
                  aria-label={showOutput ? 'Hide output' : 'Show output'}
                  aria-pressed={showOutput}
                  onClick={() => setShowOutput((value) => !value)}
                  className={cn(
                    ACTION_BUTTON,
                    showOutput && 'bg-foreground/[0.08] text-foreground',
                  )}
                >
                  Output
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
        <input
          type="search"
          aria-label="Filter tests"
          placeholder="Filter tests"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-6 min-w-0 flex-1 rounded-md border border-border/70 bg-background/60 px-2 text-[11px] outline-none focus:border-primary/50"
        />
        <div role="radiogroup" aria-label="Show" className="flex shrink-0 items-center gap-0.5">
          {(['all', 'failed', 'passed', 'skipped'] as const).map((value) => {
            const label = value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1);
            const count = value === 'all' ? null : counts[value];
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium transition-colors',
                  filter === value
                    ? 'bg-primary/12 text-primary'
                    : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
                )}
              >
                {label}
                {count ? <span className="tabular-nums opacity-70">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {summary?.errors.map((error) => (
          <RunErrorCard
            key={`${error.testProjectId}:${error.kind}`}
            error={error}
            label={labelOf(error.testProjectId)}
            onFix={() => fixResults([], [error])}
          />
        ))}
        {discovery.data.truncated ? (
          <p className="mx-2 mb-1 flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-[10px] text-warning">
            <TriangleAlert className="h-2.5 w-2.5" />
            This project has more test files than the panel reads, so some are not listed.
          </p>
        ) : null}
        <div role="tree" aria-label="Tests">
          {rows.map(({ node, depth }) => {
            const status = statuses.get(node.id);
            const own = run.results[node.id];
            const hasChildren = node.children.length > 0;
            const isCollapsed = collapsed.has(node.id);
            const failure = own?.status === 'failed' && (own.message || own.stack) ? own : null;
            const detailsOpen = failure !== null && !hiddenDetails.has(node.id);
            const duration = node.kind === 'test' ? formatDuration(own?.durationMs) : null;
            const indent = 8 + depth * 12;
            return (
              <div key={node.id}>
                <div
                  role="treeitem"
                  aria-level={depth + 1}
                  aria-expanded={hasChildren ? !isCollapsed : undefined}
                  aria-selected={false}
                  tabIndex={-1}
                  onClick={() => {
                    if (failure) toggle(node.id, setHiddenDetails);
                    else if (hasChildren) toggle(node.id, setCollapsed);
                  }}
                  onDoubleClick={() => node.file && openInEditor(project, node.file)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && hasChildren) toggle(node.id, setCollapsed);
                  }}
                  style={{ paddingLeft: indent }}
                  className={cn(
                    'group/test mx-1 flex h-6 cursor-default select-none items-center gap-1.5 rounded-md pr-1 transition-colors hover:bg-foreground/[0.05]',
                    status === 'failed' && node.kind === 'test' && 'bg-destructive/[0.04]',
                  )}
                >
                  <span className="flex h-3 w-3 shrink-0 items-center justify-center text-muted-foreground">
                    {hasChildren ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle(node.id, setCollapsed);
                        }}
                        className="flex h-3 w-3 items-center justify-center"
                      >
                        <ChevronRight
                          className={cn(
                            'h-2 w-2 transition-transform',
                            !isCollapsed && 'rotate-90',
                          )}
                        />
                      </button>
                    ) : null}
                  </span>
                  <StatusIcon status={status} />
                  {node.kind === 'file' ? (
                    <FileCode className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  ) : null}
                  <span
                    data-test-name
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      node.kind === 'project' ? 'text-[11px] font-semibold' : 'text-[12px]',
                      node.kind === 'suite' && 'text-foreground/80',
                    )}
                  >
                    {node.name}
                  </span>
                  {duration ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {duration}
                    </span>
                  ) : null}
                  <span className="flex shrink-0 items-center">
                    {node.file ? (
                      <RowButton
                        label={`Open ${node.name}`}
                        onClick={() => openInEditor(project, node.file ?? '')}
                      >
                        <FileCode className="h-2.5 w-2.5" />
                      </RowButton>
                    ) : null}
                    {!running ? (
                      <RowButton
                        label={`Run ${node.name}`}
                        onClick={() => void startRun(project.id, [targetFor(node)])}
                      >
                        <Play className="h-2.5 w-2.5" />
                      </RowButton>
                    ) : null}
                  </span>
                </div>
                {node.kind === 'project' && node.children.length === 0 ? (
                  <p
                    className="py-1 text-[11px] text-muted-foreground"
                    style={{ paddingLeft: indent + 36 }}
                  >
                    No tests found in this project.
                  </p>
                ) : null}
                {failure && detailsOpen ? (
                  <FailureDetail
                    result={failure}
                    indent={indent + 18}
                    onFix={() => fixResults([failure], [])}
                    onCopy={() => void copyIssue(failure)}
                    onOpen={
                      failure.file ? () => openInEditor(project, failure.file ?? '') : undefined
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {showOutput ? <OutputPane projectId={project.id} /> : null}

      {fixing ? (
        <FixWithAiDialog
          project={project}
          open
          onOpenChange={(open) => {
            if (!open) setFixing(null);
          }}
          title={fixing.title}
          description={fixing.description}
          jobKey={fixing.jobKey}
          source={fixing.source}
        />
      ) : null}
    </div>
  );
}

function FailureDetail({
  result,
  indent,
  onFix,
  onCopy,
  onOpen,
}: {
  result: TestResult;
  indent: number;
  onFix: () => void;
  onCopy: () => void;
  onOpen?: () => void;
}): React.JSX.Element {
  const [showStack, setShowStack] = useState(false);
  const name = result.path.length > 0 ? result.path.join(' > ') : (result.file ?? 'file');
  return (
    <div
      role="group"
      aria-label={`${name} failure`}
      style={{ marginLeft: indent }}
      className="mb-1.5 mr-2 mt-0.5 rounded-md border border-destructive/25 bg-destructive/[0.04] p-2"
    >
      {result.message ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-destructive">
          {result.message}
        </pre>
      ) : null}
      {result.stack ? (
        <>
          <button
            type="button"
            onClick={() => setShowStack((value) => !value)}
            className="mt-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            {showStack ? 'Hide stack' : 'Show stack'}
          </button>
          {showStack ? (
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre font-mono text-[10px] leading-relaxed text-muted-foreground">
              {result.stack}
            </pre>
          ) : null}
        </>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={onFix}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-primary/12 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          <Wand2 className="h-2.5 w-2.5" />
          Fix with AI
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Copy className="h-2.5 w-2.5" />
          Copy issue
        </button>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <FileCode className="h-2.5 w-2.5" />
            Open file
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RunErrorCard({
  error,
  label,
  onFix,
}: {
  error: TestRunError;
  label: string;
  onFix: () => void;
}): React.JSX.Element {
  const log = error.log.trim();
  return (
    <div
      role="group"
      aria-label={`${label} could not run`}
      className="mx-2 mb-1.5 rounded-md border border-destructive/25 bg-destructive/[0.04] p-2"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
        <TriangleAlert className="h-2.5 w-2.5" />
        {label} could not run
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/80">{error.message}</p>
      {log ? (
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-muted-foreground">
          {log.slice(-4_000)}
        </pre>
      ) : null}
      <div className="mt-1.5 flex items-center gap-1">
        {error.kind !== 'notFound' ? (
          <button
            type="button"
            onClick={onFix}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-primary/12 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <Wand2 className="h-2.5 w-2.5" />
            Fix with AI
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(
              `$ ${error.command}\n\n${error.message}\n\n${log}`.trim(),
            );
            toast.success('Output copied');
          }}
          className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Copy className="h-2.5 w-2.5" />
          Copy output
        </button>
      </div>
    </div>
  );
}
