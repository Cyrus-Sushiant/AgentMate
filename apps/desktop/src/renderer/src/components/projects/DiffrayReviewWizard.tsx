import type { AgentType } from '@agentmat/core';
import {
  allDiffrayAgentIds,
  allDiffraySeverities,
  buildDiffrayProjectConfig,
  buildDiffrayReviewCommand,
  defaultDiffrayExecutorForAgentType,
  DIFFRAY_AGENTS,
  DIFFRAY_EXECUTORS,
  DIFFRAY_GITHUB_APP_URL,
  DIFFRAY_MODELS,
  DIFFRAY_PROJECT_CONFIG_FILE,
  type DiffrayExecutorId,
  type DiffrayReviewScope,
} from '@agentmat/core';
import type { GitStatus } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Bolt,
  Bug,
  Check,
  Code,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Play,
  Shield,
  Spinner,
  Wrench,
} from '@/components/icons';
import { ProjectEmptyState } from '@/components/projects/ProjectDetailChrome';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminalStore';

type WizardStep = 'diff' | 'agents' | 'engine' | 'launch';

const STEPS: { id: WizardStep; label: string; hint: string }[] = [
  { id: 'diff', label: 'Diffs', hint: 'What to scan' },
  { id: 'agents', label: 'Agents', hint: 'Who looks' },
  { id: 'engine', label: 'Engine', hint: 'Which AI' },
  { id: 'launch', label: 'Launch', hint: 'Run the review' },
];

const AGENT_ICON = {
  general: Code,
  'bug-hunter': Bug,
  'security-scan': Shield,
  'performance-check': Bolt,
  'consistency-check': Copy,
} as const;

const AGENT_GUTTER: Record<string, string> = {
  general: 'border-l-primary',
  'bug-hunter': 'border-l-destructive',
  'security-scan': 'border-l-warning',
  'performance-check': 'border-l-primary/70',
  'consistency-check': 'border-l-foreground/40',
};

function defaultScope(status: GitStatus | undefined): DiffrayReviewScope {
  if (!status?.isRepo) return 'working-tree';
  if (status.files.length > 0) return 'working-tree';
  if (status.defaultBranch && status.branch && status.branch !== status.defaultBranch) {
    return 'base-branch';
  }
  return 'working-tree';
}

export function DiffrayReviewLaunchCard({
  installed,
  onOpen,
}: {
  installed: boolean;
  onOpen: () => void;
}): React.JSX.Element | null {
  if (!installed) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="absolute inset-y-0 left-0 w-1 overflow-hidden"
        aria-hidden
      >
        <span className="block h-1/2 bg-primary" />
        <span className="block h-1/2 bg-destructive/70" />
      </span>
      <span className="flex items-start gap-3 pl-2">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GitPullRequest className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Review with diffray</span>
            <Badge variant="secondary">Multi-agent</Badge>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Run specialized agents over this project's git changes, then read the report in the
            terminal.
          </span>
        </span>
        <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </span>
    </button>
  );
}

export function DiffrayReviewWizard({
  projectId,
  projectName,
  folderPath,
  agentType,
  installed,
}: {
  projectId: string;
  projectName: string;
  folderPath: string;
  agentType: AgentType;
  installed: boolean;
}): React.JSX.Element {
  const navigate = useNavigate();
  const openSession = useTerminalStore((s) => s.openSession);

  const [step, setStep] = useState<WizardStep>('diff');
  const [scope, setScope] = useState<DiffrayReviewScope>('working-tree');
  const [baseRef, setBaseRef] = useState('');
  const [commitCount, setCommitCount] = useState(3);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [fullFiles, setFullFiles] = useState(false);
  const [agentIds, setAgentIds] = useState<Set<string>>(() => new Set(allDiffrayAgentIds()));
  const [executor, setExecutor] = useState<DiffrayExecutorId>(() =>
    defaultDiffrayExecutorForAgentType(agentType),
  );
  const [model, setModel] = useState('');
  const [severities, setSeverities] = useState<Set<string>>(() => new Set(allDiffraySeverities()));
  const [skipValidation, setSkipValidation] = useState(false);
  const [stream, setStream] = useState(true);
  const [writeConfig, setWriteConfig] = useState(false);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const gitDefaultsApplied = useRef(false);

  const gitQuery = useQuery({
    queryKey: queryKeys.gitStatus(projectId),
    queryFn: () => window.agentmat.git.status(projectId),
    enabled: installed,
  });

  useEffect(() => {
    if (!installed) return;
    let cancelled = false;
    void window.agentmat.fs
      .readFile(`${folderPath}/${DIFFRAY_PROJECT_CONFIG_FILE}`)
      .then(() => {
        if (!cancelled) setHasConfig(true);
      })
      .catch(() => {
        if (!cancelled) setHasConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folderPath, installed]);

  useEffect(() => {
    const gitStatus = gitQuery.data;
    if (!gitStatus?.isRepo || gitDefaultsApplied.current) return;
    gitDefaultsApplied.current = true;
    setScope(defaultScope(gitStatus));
    if (gitStatus.defaultBranch) setBaseRef(gitStatus.defaultBranch);
    else if (gitStatus.branch) setBaseRef(gitStatus.branch);
    setSelectedFiles(new Set(gitStatus.files.map((file) => file.path)));
  }, [gitQuery.data]);

  const models = DIFFRAY_MODELS[executor] ?? [{ value: '', label: 'Executor default' }];
  const stepIndex = STEPS.findIndex((entry) => entry.id === step);
  const status = gitQuery.data;
  const changedFiles = status?.files ?? [];
  const branchOptions = useMemo(() => {
    const names = new Set<string>();
    for (const branch of status?.branches ?? []) {
      if (branch.local || branch.remote) names.add(branch.name);
    }
    if (status?.defaultBranch) names.add(status.defaultBranch);
    if (status?.branch) names.add(status.branch);
    return [...names].sort().map((name) => ({ value: name, label: name }));
  }, [status]);

  const command = useMemo(
    () =>
      buildDiffrayReviewCommand({
        scope,
        baseRef,
        commitCount,
        files: [...selectedFiles],
        fullFiles,
        agentIds: [...agentIds],
        executor,
        model,
        severities: [...severities],
        skipValidation,
        stream,
      }),
    [
      agentIds,
      baseRef,
      commitCount,
      executor,
      fullFiles,
      model,
      scope,
      selectedFiles,
      severities,
      skipValidation,
      stream,
    ],
  );

  const canContinue =
    (step === 'diff' &&
      (scope === 'working-tree' ||
        (scope === 'base-branch' && Boolean(baseRef.trim())) ||
        (scope === 'last-commits' && commitCount >= 1) ||
        (scope === 'files' && selectedFiles.size > 0))) ||
    (step === 'agents' && agentIds.size > 0) ||
    (step === 'engine' && Boolean(executor)) ||
    step === 'launch';

  function goNext(): void {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  }

  function goBack(): void {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }

  function toggleAgent(id: string): void {
    setAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSeverity(id: string): void {
    setSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFile(path: string): void {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleLaunch(): Promise<void> {
    if (writeConfig) {
      const action = buildDiffrayProjectConfig({
        executor,
        excludeTests: true,
      });
      if (action.kind === 'write-project-file') {
        await window.agentmat.fs.writeFile(
          `${folderPath}/${action.relativePath}`,
          action.content,
        );
        setHasConfig(true);
        toast.success(`${DIFFRAY_PROJECT_CONFIG_FILE} written to ${projectName}.`);
      }
    }
    openSession({
      title: `diffray · ${projectName}`,
      initialInput: command,
      cwd: folderPath,
      projectId,
    });
    toast.info('Press Enter in the terminal to start the review.');
  }

  if (!installed) {
    return (
      <ProjectEmptyState
        icon={GitPullRequest}
        title="diffray is not installed yet"
        description="Install the CLI from Agent Tools, then come back here to review this project's changes with specialized agents."
        action={
          <Button variant="outline" onClick={() => navigate('/tools')}>
            <Wrench /> Open Agent Tools
          </Button>
        }
      />
    );
  }

  if (gitQuery.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-10 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4 animate-spin" /> Reading git status…
      </div>
    );
  }

  if (!status?.isRepo) {
    return (
      <ProjectEmptyState
        icon={GitBranch}
        title="This folder is not a git repository"
        description="diffray reviews git diffs. Initialize a repository on the Git tab first."
        action={
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}?tab=git`)}>
            <GitBranch /> Open Git
          </Button>
        }
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="absolute inset-y-0 left-0 w-1 overflow-hidden" aria-hidden>
        <div className="h-1/2 bg-primary" />
        <div className="h-1/2 bg-destructive/70" />
      </div>

      <div className="space-y-5 p-5 pl-6">
        <header className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Multi-agent review
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Review this change set
          </h2>
          <p className="text-sm text-muted-foreground">
            {status.branch ? (
              <>
                Scanning <span className="font-mono text-foreground">{status.branch}</span>
                {status.files.length > 0
                  ? ` · ${status.files.length} changed file${status.files.length === 1 ? '' : 's'}`
                  : ' · working tree is clean'}
              </>
            ) : (
              'Pick a diff, choose agents, then run the review in the project terminal.'
            )}
          </p>
        </header>

        <ol className="grid grid-cols-4 gap-1.5">
          {STEPS.map((entry, index) => {
            const active = entry.id === step;
            const done = index < stepIndex;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setStep(entry.id)}
                  className={cn(
                    'w-full rounded-lg border px-2 py-2 text-left transition-colors',
                    active
                      ? 'border-primary/50 bg-primary/10'
                      : done
                        ? 'border-border bg-muted/40 hover:bg-muted'
                        : 'border-border bg-background/40 hover:bg-muted/50',
                  )}
                >
                  <span
                    className={cn(
                      'block text-[11px] font-medium uppercase tracking-wide',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {entry.label}
                  </span>
                  <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                    {entry.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="min-h-[16rem] space-y-3">
          {step === 'diff' && (
            <>
              <ScopeCard
                selected={scope === 'working-tree'}
                title="Working tree"
                description="Uncommitted changes, or the last commit if the tree is clean."
                icon={Code}
                onClick={() => setScope('working-tree')}
              />
              <ScopeCard
                selected={scope === 'base-branch'}
                title="Compare to a branch"
                description="Everything this branch added since the base you pick."
                icon={GitBranch}
                onClick={() => setScope('base-branch')}
              >
                {scope === 'base-branch' && (
                  <div className="mt-2.5 space-y-1.5" onClick={(event) => event.stopPropagation()}>
                    <Label>Base branch</Label>
                    <Combobox
                      className="w-full font-mono"
                      value={baseRef}
                      onChange={setBaseRef}
                      options={branchOptions}
                      placeholder="main"
                      searchPlaceholder="Search branches…"
                    />
                  </div>
                )}
              </ScopeCard>
              <ScopeCard
                selected={scope === 'last-commits'}
                title="Last N commits"
                description="Review a short window of recent history on this branch."
                icon={GitCommit}
                onClick={() => setScope('last-commits')}
              >
                {scope === 'last-commits' && (
                  <div className="mt-2.5 space-y-1.5" onClick={(event) => event.stopPropagation()}>
                    <Label htmlFor="diffray-commit-count">Commit count</Label>
                    <Input
                      id="diffray-commit-count"
                      type="number"
                      min={1}
                      max={50}
                      value={commitCount}
                      onChange={(event) =>
                        setCommitCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))
                      }
                      className="w-28 font-mono"
                    />
                  </div>
                )}
              </ScopeCard>
              <ScopeCard
                selected={scope === 'files'}
                title="Changed files"
                description={
                  changedFiles.length > 0
                    ? 'Limit the review to files that already differ in git.'
                    : 'No changed files in the working tree right now.'
                }
                icon={GitPullRequest}
                disabled={changedFiles.length === 0}
                onClick={() => changedFiles.length > 0 && setScope('files')}
              >
                {scope === 'files' && changedFiles.length > 0 && (
                  <div className="mt-2.5 space-y-2" onClick={(event) => event.stopPropagation()}>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background/60 p-2">
                      {changedFiles.map((file) => (
                        <label
                          key={file.path}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/60"
                        >
                          <Checkbox
                            checked={selectedFiles.has(file.path)}
                            onCheckedChange={() => toggleFile(file.path)}
                          />
                          <span className="min-w-0 truncate font-mono text-xs">{file.path}</span>
                        </label>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={fullFiles} onCheckedChange={setFullFiles} />
                      Review the whole file, not just the diff
                    </label>
                  </div>
                )}
              </ScopeCard>
            </>
          )}

          {step === 'agents' && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Each agent reads the same diff in isolation, then findings are deduplicated and
                  validated.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setAgentIds(
                      agentIds.size === DIFFRAY_AGENTS.length
                        ? new Set()
                        : new Set(allDiffrayAgentIds()),
                    )
                  }
                >
                  {agentIds.size === DIFFRAY_AGENTS.length ? 'Clear' : 'Select all'}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DIFFRAY_AGENTS.map((agent) => {
                  const Icon = AGENT_ICON[agent.id];
                  const checked = agentIds.has(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgent(agent.id)}
                      className={cn(
                        'rounded-lg border border-l-4 px-3 py-3 text-left transition-colors',
                        AGENT_GUTTER[agent.id],
                        checked
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-background/50 hover:bg-muted/40',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {agent.label}
                        {checked && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {agent.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 'engine' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DIFFRAY_EXECUTORS.map((entry) => {
                  const selected = executor === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setExecutor(entry.id);
                        setModel('');
                      }}
                      className={cn(
                        'rounded-lg border px-3 py-3 text-left transition-colors',
                        selected
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border bg-background/50 hover:bg-muted/40',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {entry.label}
                        {selected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {entry.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label>Model</Label>
                <Combobox
                  value={model || '__default'}
                  onChange={(next) => setModel(next === '__default' ? '' : next)}
                  options={models.map((entry) =>
                    entry.value ? entry : { ...entry, value: '__default' },
                  )}
                  placeholder="Executor default"
                />
              </div>

              <div className="space-y-2">
                <Label>Severity filter</Label>
                <div className="flex flex-wrap gap-1.5">
                  {allDiffraySeverities().map((severity) => {
                    const checked = severities.has(severity);
                    return (
                      <button
                        key={severity}
                        type="button"
                        onClick={() => toggleSeverity(severity)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs capitalize transition-colors',
                          checked
                            ? 'border-primary/50 bg-primary/15 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted/50',
                        )}
                      >
                        {severity}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">Skip validation</span>
                  <span className="text-xs text-muted-foreground">
                    Faster, with more false positives.
                  </span>
                </span>
                <Switch checked={skipValidation} onCheckedChange={setSkipValidation} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">Stream progress</span>
                  <span className="text-xs text-muted-foreground">
                    Show each agent as it works in the terminal.
                  </span>
                </span>
                <Switch checked={stream} onCheckedChange={setStream} />
              </label>
            </div>
          )}

          {step === 'launch' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The command is not run until you press Enter in the terminal. That keeps the review
                in your hands.
              </p>
              <div className="overflow-hidden rounded-lg border border-border bg-background font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span className="text-primary">+</span> review hunk
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-2.5 text-foreground">
                  {command}
                </pre>
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                <Switch
                  className="mt-0.5"
                  checked={writeConfig}
                  onCheckedChange={setWriteConfig}
                />
                <span>
                  <span className="block text-sm font-medium">
                    {hasConfig ? 'Update' : 'Write'} {DIFFRAY_PROJECT_CONFIG_FILE}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Saves the executor and skips tests, dist, and node_modules on later runs.
                  </span>
                </span>
              </label>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40"
                onClick={() => void window.agentmat.shell.openExternal(DIFFRAY_GITHUB_APP_URL)}
              >
                <span>Want automatic PR comments? Install the GitHub App instead.</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
            <ArrowLeft /> Back
          </Button>
          {step === 'launch' ? (
            <Button onClick={() => void handleLaunch()} disabled={!canContinue}>
              <Play /> Run review
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canContinue}>
              Continue <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScopeCard({
  selected,
  title,
  description,
  icon: Icon,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: typeof Code;
  disabled?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-primary/50 bg-primary/10'
          : 'border-border bg-background/50 hover:bg-muted/40',
      )}
    >
      <span className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {title}
            {selected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          {children}
        </span>
      </span>
    </button>
  );
}
