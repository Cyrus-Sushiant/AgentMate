import type { AgentType, Project, ProjectRunCommand } from '@agentmat/core';
import { AGENT_TYPES, browsableRepoUrl, CLI_REGISTRY, configuredRunCommands } from '@agentmat/core';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cliOptionIcon } from '@/components/cliLogos';
import {
  FolderOpen,
  GitBranch,
  Globe,
  Plus,
  Sparkles,
  Spinner,
  Tag,
  TerminalSquare,
  Trash2,
  Upload,
  X,
} from '@/components/icons';
import { ProjectIcon } from '@/components/projects/ProjectIcon';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GrammarTextarea } from '@/components/grammar/GrammarTextarea';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Combobox needs a non-empty value, so "inherit the app default" travels as this sentinel. */
const APP_DEFAULT_CLI = '__app-default__';

/**
 * Oversized drops are shrunk to icon size in the main process rather than
 * refused. This is only the point past which a file stops looking like a logo
 * and starts looking like a mistake.
 */
const MAX_ICON_BYTES = 40 * 1024 * 1024;

/**
 * Anything thrown in the main process reaches the renderer wrapped in Electron's
 * "Error invoking remote method 'projects:pickIcon': Error: ..." boilerplate,
 * which is not what belongs in a toast.
 */
function iconErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message
    .replace(/^Error invoking remote method '[^']*':\s*/, '')
    .replace(/^(Error|TypeError):\s*/, '')
    .trim();
  return message || fallback;
}

export interface ProjectFormValues {
  name: string;
  folderPath: string;
  description: string;
  tags: string[];
  agentType: AgentType;
  notes: string;
  runCommands: ProjectRunCommand[];
  /** null = follow the app-wide default CLI from Settings. */
  cliId: string | null;
  /** Icon inlined as a data URL, either picked from disk or fetched from the site. */
  iconDataUrl: string | null;
  websiteUrl: string;
  /** Git repository the code lives in. Stored as a link, nothing is run against it. */
  repoUrl: string;
}

export interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Project;
  onSubmit: (values: ProjectFormValues) => void;
  isSubmitting?: boolean;
}

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Appends whatever isn't already in the list, matching case-insensitively. */
function mergeTags(existing: string[], incoming: string[]): string[] {
  const next = [...existing];
  for (const tag of incoming) {
    if (!next.some((t) => t.toLowerCase() === tag.toLowerCase())) next.push(tag);
  }
  return next;
}

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

function emptyRunCommand(): ProjectRunCommand {
  return { id: crypto.randomUUID(), label: '', command: '' };
}

function draftsFromProject(initial?: Project): ProjectRunCommand[] {
  const existing = initial ? configuredRunCommands(initial) : [];
  if (existing.length === 0) return [emptyRunCommand()];
  return existing.map((entry) => ({ ...entry }));
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting,
}: ProjectFormDialogProps): React.JSX.Element {
  const ids = useId();
  const [tab, setTab] = useState('basics');
  const [name, setName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('claude-code');
  const [notes, setNotes] = useState('');
  const [runCommands, setRunCommands] = useState<ProjectRunCommand[]>([emptyRunCommand()]);
  const [cliId, setCliId] = useState<string>(APP_DEFAULT_CLI);
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoDetected, setRepoDetected] = useState(false);
  const [fetchingFavicon, setFetchingFavicon] = useState(false);
  const [iconDragOver, setIconDragOver] = useState(false);
  // Remembers the last URL the auto-fetch already tried, so tabbing in and out
  // of the field doesn't re-download the same favicon on every blur.
  const autoFetchedUrl = useRef<string | null>(null);
  // Same idea for the repository lookup: one git call per folder, not one per blur.
  const detectedRepoPath = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: this fills the form when the dialog opens, and detectRepoUrl is rebuilt on every render
  useEffect(() => {
    if (!open) return;
    setTab('basics');
    setName(initial?.name ?? '');
    setFolderPath(initial?.folderPath ?? '');
    setDescription(initial?.description ?? '');
    setTags(initial?.tags ?? []);
    setTagDraft('');
    setAgentType(initial?.agentType ?? 'claude-code');
    setNotes(initial?.notes ?? '');
    setRunCommands(draftsFromProject(initial));
    setCliId(initial?.cliId ?? APP_DEFAULT_CLI);
    setIconDataUrl(initial?.iconDataUrl ?? null);
    setWebsiteUrl(initial?.websiteUrl ?? '');
    setRepoUrl(initial?.repoUrl ?? '');
    setRepoDetected(false);
    setFetchingFavicon(false);
    setIconDragOver(false);
    autoFetchedUrl.current = initial?.websiteUrl || null;
    detectedRepoPath.current = null;
    // An existing project may predate this field, so look its folder up too.
    void detectRepoUrl(initial?.folderPath ?? '', initial?.repoUrl ?? '');
  }, [open, initial]);

  /**
   * Fills the repository field from the folder's origin remote. `current` is passed
   * in rather than read off state because the callers know it sooner than React does,
   * and an address the user typed themselves is never overwritten.
   */
  async function detectRepoUrl(folder: string, current: string): Promise<void> {
    const path = folder.trim();
    if (!path || current.trim() || path === detectedRepoPath.current) return;
    detectedRepoPath.current = path;
    // A folder that isn't a repo, or a git that isn't installed, just leaves the
    // field empty: this is a convenience, not something to interrupt over.
    const detected = await window.agentmat.git.detectRemote(path).catch(() => null);
    if (!detected) return;
    setRepoUrl(detected);
    setRepoDetected(true);
  }

  async function handlePickFolder(): Promise<void> {
    const picked = await window.agentmat.projects.pickFolder();
    if (!picked) return;
    setFolderPath(picked);
    // Naming a new project after its folder is right often enough to be worth
    // filling in, and it never overwrites something already typed.
    setName((current) => (current.trim() ? current : folderName(picked)));
    void detectRepoUrl(picked, repoUrl);
  }

  async function handlePickIcon(): Promise<void> {
    try {
      const dataUrl = await window.agentmat.projects.pickIcon();
      if (dataUrl) setIconDataUrl(dataUrl);
    } catch (error) {
      toast.error(iconErrorMessage(error, 'Could not read that image.'));
    }
  }

  function handleIconDrop(event: React.DragEvent): void {
    event.preventDefault();
    setIconDragOver(false);
    const file = Array.from(event.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (!file) {
      toast.error('Drop an image file to use it as the icon.');
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      toast.error('That image is too large to read.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      // Same trip a picked file makes: the main process is where an oversized
      // image gets scaled down to something worth storing as an icon.
      void window.agentmat.projects
        .normalizeIcon(reader.result)
        .then(setIconDataUrl)
        .catch((error: unknown) =>
          toast.error(iconErrorMessage(error, 'Could not read that image.')),
        );
    };
    reader.onerror = () => toast.error('Could not read that image.');
    reader.readAsDataURL(file);
  }

  /**
   * `silent` is the on-blur pass: it fills an empty icon slot as a convenience,
   * so a site without a favicon shouldn't nag. Pressing the button is a request,
   * and gets told what happened either way.
   */
  async function handleFetchFavicon(silent: boolean): Promise<void> {
    const url = websiteUrl.trim();
    if (!url || fetchingFavicon) return;
    autoFetchedUrl.current = url;
    setFetchingFavicon(true);
    try {
      const result = await window.agentmat.projects.fetchFavicon(url);
      if (!result) {
        if (!silent) toast.error("Couldn't find a favicon on that site.");
        return;
      }
      setIconDataUrl(result.dataUrl);
      setWebsiteUrl(result.siteUrl);
      if (!silent) toast.success('Favicon downloaded.');
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'Could not reach that site.');
      }
    } finally {
      setFetchingFavicon(false);
    }
  }

  function handleWebsiteBlur(): void {
    const url = websiteUrl.trim();
    if (!url || iconDataUrl || url === autoFetchedUrl.current) return;
    void handleFetchFavicon(true);
  }

  function commitTagDraft(): void {
    if (!tagDraft.trim()) return;
    setTags((prev) => mergeTags(prev, splitTags(tagDraft)));
    setTagDraft('');
  }

  function handleTagKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitTagDraft();
      return;
    }
    // Backspace on an empty box walks back through the chips, the way every
    // other tag field does.
    if (event.key === 'Backspace' && !tagDraft) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  const canSubmit = name.trim().length > 0 && folderPath.length > 0;

  function handleSubmit(): void {
    if (!canSubmit || isSubmitting) return;
    onSubmit({
      name: name.trim(),
      folderPath,
      description,
      // A tag still sitting in the box counts: nobody expects it to be dropped
      // because they clicked Save instead of pressing Enter first.
      tags: mergeTags(tags, splitTags(tagDraft)),
      agentType,
      notes,
      runCommands: runCommands
        .filter((row) => row.command.trim().length > 0)
        .map((row) => ({
          id: row.id,
          label: row.label.trim(),
          command: row.command.trim(),
        })),
      cliId: cliId === APP_DEFAULT_CLI ? null : cliId,
      iconDataUrl,
      websiteUrl: websiteUrl.trim(),
      // Normalized on the way out so the stored value is always openable, even
      // when it was pasted as "github.com/me/app" or as an ssh remote.
      repoUrl: repoUrl.trim() ? browsableRepoUrl(repoUrl) : '',
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl gap-0 overflow-hidden p-0"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            handleSubmit();
          }
        }}
      >
        <DialogHeader className="flex-row items-center gap-3 border-b border-border/70 px-6 py-5">
          <ProjectIcon
            iconDataUrl={iconDataUrl}
            className="h-11 w-11 rounded-xl border border-border/70"
            glyphClassName="h-5 w-5"
          />
          <div className="min-w-0 space-y-1 pr-8">
            <DialogTitle>{initial ? 'Edit project' : 'New project'}</DialogTitle>
            <DialogDescription>
              {initial
                ? 'Update how this project looks and which tools it runs with.'
                : 'Point AgentMate at a folder, then fine tune the rest whenever you like.'}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-col">
          <TabsList containerClassName="px-6" className="gap-4">
            <TabsTrigger value="basics" className="gap-2 px-0">
              <Tag className="h-3.5 w-3.5" /> Basics
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2 px-0">
              <Sparkles className="h-3.5 w-3.5" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="agent" className="gap-2 px-0">
              <TerminalSquare className="h-3.5 w-3.5" /> Agent
            </TabsTrigger>
          </TabsList>

          {/* The min height on each tab keeps the dialog from resizing as tabs
              are switched, while the container itself stays free to shrink and
              scroll on a short window. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
            <TabsContent value="basics" className="mt-5 min-h-[19rem] space-y-4">
              <Field label="Name" htmlFor={`${ids}-name`} required>
                <Input
                  id={`${ids}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My App"
                  autoFocus
                />
              </Field>

              <Field
                label="Folder"
                htmlFor={`${ids}-folder`}
                required
                hint="Where the project lives on this machine. Terminals and agents start here."
              >
                <div className="flex gap-2">
                  <Input
                    id={`${ids}-folder`}
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    onBlur={() => void detectRepoUrl(folderPath, repoUrl)}
                    placeholder="Paste a path or choose a folder…"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void handlePickFolder()}
                  >
                    <FolderOpen className="h-4 w-4" /> Browse
                  </Button>
                </div>
              </Field>

              <Field
                label="Git repository"
                htmlFor={`${ids}-repo`}
                hint={
                  repoDetected
                    ? "Read from the folder's origin remote. Change it if the code lives somewhere else."
                    : 'Where the code is hosted, if it already is somewhere. Kept as a link: nothing is cloned or pushed.'
                }
              >
                <div className="flex gap-2">
                  <Input
                    id={`${ids}-repo`}
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      setRepoDetected(false);
                    }}
                    placeholder="github.com/me/my-app"
                    className="font-mono text-xs"
                  />
                  {repoUrl.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() =>
                        void window.agentmat.shell.openExternal(browsableRepoUrl(repoUrl))
                      }
                    >
                      <GitBranch className="h-4 w-4" /> Open
                    </Button>
                  )}
                </div>
              </Field>

              <Field
                label="Tags"
                htmlFor={`${ids}-tags`}
                hint="Press Enter or comma to add one. They power search and filtering."
              >
                {/* A label so a click anywhere in the empty space lands in the input. */}
                <label
                  htmlFor={`${ids}-tags`}
                  className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/50"
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary py-0.5 pl-2.5 pr-1.5 text-xs text-secondary-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                        className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    id={`${ids}-tags`}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={commitTagDraft}
                    placeholder={tags.length ? 'Add another…' : 'frontend, web'}
                    className="h-6 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </Field>

              <Field label="Description" htmlFor={`${ids}-description`}>
                <GrammarTextarea
                  id={`${ids}-description`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="One line about what this project is."
                />
              </Field>
            </TabsContent>

            <TabsContent value="appearance" className="mt-5 min-h-[19rem] space-y-4">
              <Field
                label="Icon"
                hint="Shown on the project card and in the sidebar. PNG or SVG looks best."
              >
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => void handlePickIcon()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIconDragOver(true);
                    }}
                    onDragLeave={() => setIconDragOver(false)}
                    onDrop={handleIconDrop}
                    className={cn(
                      'group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:border-primary/50',
                      iconDragOver && 'border-primary bg-primary/10',
                    )}
                  >
                    <ProjectIcon
                      iconDataUrl={iconDataUrl}
                      className="h-full w-full rounded-none bg-transparent text-muted-foreground"
                      glyphClassName="h-6 w-6"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-background/80 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                      <Upload className="h-4 w-4" />
                    </span>
                  </button>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handlePickIcon()}
                      >
                        <Upload className="h-3.5 w-3.5" /> Choose image
                      </Button>
                      {iconDataUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIconDataUrl(null)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Or drop an image on the tile. Leave it empty for the folder glyph.
                    </p>
                  </div>
                </div>
              </Field>

              <Field
                label="Website"
                htmlFor={`${ids}-website`}
                hint="The project's site. Its favicon becomes the icon when you haven't picked an image."
              >
                <div className="flex gap-2">
                  <Input
                    id={`${ids}-website`}
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    onBlur={handleWebsiteBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleFetchFavicon(false);
                      }
                    }}
                    placeholder="example.com"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={!websiteUrl.trim() || fetchingFavicon}
                    onClick={() => void handleFetchFavicon(false)}
                  >
                    {fetchingFavicon ? (
                      <Spinner className="h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    Use favicon
                  </Button>
                </div>
              </Field>
            </TabsContent>

            <TabsContent value="agent" className="mt-5 min-h-[19rem] space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Agent type" hint="How AgentMate talks to this project's assistant.">
                  <Combobox
                    value={agentType}
                    onChange={(v) => setAgentType(v as AgentType)}
                    options={AGENT_TYPES.map((a) => ({
                      value: a.value,
                      label: a.label,
                      icon: cliOptionIcon(a.cliId),
                    }))}
                  />
                </Field>

                <Field label="AI CLI" hint="Runs tag suggestions, version bumps, and the like.">
                  <Combobox
                    value={cliId}
                    onChange={setCliId}
                    options={[
                      { value: APP_DEFAULT_CLI, label: 'App default (from Settings)' },
                      ...CLI_REGISTRY.map((cli) => ({
                        value: cli.id,
                        label: cli.name,
                        icon: cliOptionIcon(cli.id),
                      })),
                    ]}
                  />
                </Field>
              </div>

              <Field
                label="Run commands"
                hint="What the Run button executes in the project folder. Add one per environment if you need more than one; Run will ask which to use."
              >
                <div className="space-y-2">
                  <div className="flex gap-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="w-[7.5rem] shrink-0 px-1">Environment</span>
                    <span className="min-w-0 flex-1 px-1">Command</span>
                    <span className="w-9 shrink-0" />
                  </div>
                  {runCommands.map((row, index) => (
                    <div key={row.id} className="flex gap-2">
                      <Input
                        value={row.label}
                        onChange={(e) =>
                          setRunCommands((prev) =>
                            prev.map((item) =>
                              item.id === row.id ? { ...item, label: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="dev"
                        aria-label={`Environment ${index + 1}`}
                        className="w-[7.5rem] shrink-0"
                      />
                      <Input
                        value={row.command}
                        onChange={(e) =>
                          setRunCommands((prev) =>
                            prev.map((item) =>
                              item.id === row.id ? { ...item, command: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="npm run dev"
                        aria-label={`Command ${index + 1}`}
                        className="min-w-0 flex-1 font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove command ${index + 1}`}
                        className="shrink-0"
                        onClick={() =>
                          setRunCommands((prev) => {
                            const next = prev.filter((item) => item.id !== row.id);
                            return next.length > 0 ? next : [emptyRunCommand()];
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRunCommands((prev) => [...prev, emptyRunCommand()])}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add command
                  </Button>
                </div>
              </Field>

              <Field label="Notes" htmlFor={`${ids}-notes`}>
                <GrammarTextarea
                  id={`${ids}-notes`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Anything worth remembering: credentials location, quirks, todos."
                />
              </Field>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="items-center border-t border-border/70 bg-muted/20 px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {canSubmit ? 'Ctrl+Enter to save' : 'Name and folder are required'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SimpleTooltip
              label={canSubmit ? '' : 'Fill in the name and folder on the Basics tab'}
              wrapTrigger
            >
              <Button disabled={!canSubmit || isSubmitting} onClick={handleSubmit}>
                {isSubmitting && <Spinner className="h-4 w-4 animate-spin" />}
                {initial ? 'Save changes' : 'Create project'}
              </Button>
            </SimpleTooltip>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One labelled control with its optional hint, so the three tabs stay consistent. */
function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-primary">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
