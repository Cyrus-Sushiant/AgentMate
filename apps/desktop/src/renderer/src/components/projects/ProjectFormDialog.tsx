import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FolderOpen, Globe, Spinner, Trash2, Upload } from '@/components/icons';
import { CLI_REGISTRY } from '@agentmat/core';
import type { AgentType, Project } from '@agentmat/core';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { ProjectIcon } from '@/components/projects/ProjectIcon';

const AGENT_TYPES: { value: AgentType; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'opencode', label: 'OpenCode' },
  { value: 'codex', label: 'Codex' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'generic', label: 'Generic' },
];

/** Combobox needs a non-empty value, so "inherit the app default" travels as this sentinel. */
const APP_DEFAULT_CLI = '__app-default__';

export interface ProjectFormValues {
  name: string;
  folderPath: string;
  description: string;
  tags: string[];
  agentType: AgentType;
  notes: string;
  runCommand: string;
  /** null = follow the app-wide default CLI from Settings. */
  cliId: string | null;
  /** Icon inlined as a data URL, either picked from disk or fetched from the site. */
  iconDataUrl: string | null;
  websiteUrl: string;
}

export interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Project;
  onSubmit: (values: ProjectFormValues) => void;
  isSubmitting?: boolean;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting,
}: ProjectFormDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('claude-code');
  const [notes, setNotes] = useState('');
  const [runCommand, setRunCommand] = useState('');
  const [cliId, setCliId] = useState<string>(APP_DEFAULT_CLI);
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [fetchingFavicon, setFetchingFavicon] = useState(false);
  // Remembers the last URL the auto-fetch already tried, so tabbing in and out
  // of the field doesn't re-download the same favicon on every blur.
  const autoFetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setFolderPath(initial?.folderPath ?? '');
    setDescription(initial?.description ?? '');
    setTagsText(initial?.tags.join(', ') ?? '');
    setAgentType(initial?.agentType ?? 'claude-code');
    setNotes(initial?.notes ?? '');
    setRunCommand(initial?.runCommand ?? '');
    setCliId(initial?.cliId ?? APP_DEFAULT_CLI);
    setIconDataUrl(initial?.iconDataUrl ?? null);
    setWebsiteUrl(initial?.websiteUrl ?? '');
    setFetchingFavicon(false);
    autoFetchedUrl.current = initial?.websiteUrl || null;
  }, [open, initial]);

  async function handlePickFolder(): Promise<void> {
    const picked = await window.agentmat.projects.pickFolder();
    if (picked) setFolderPath(picked);
  }

  async function handlePickIcon(): Promise<void> {
    try {
      const dataUrl = await window.agentmat.projects.pickIcon();
      if (dataUrl) setIconDataUrl(dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that image.');
    }
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

  function handleSubmit(): void {
    onSubmit({
      name: name.trim(),
      folderPath,
      description,
      tags: tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      agentType,
      notes,
      runCommand: runCommand.trim(),
      cliId: cliId === APP_DEFAULT_CLI ? null : cliId,
      iconDataUrl,
      websiteUrl: websiteUrl.trim(),
    });
  }

  const canSubmit = name.trim().length > 0 && folderPath.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit project' : 'New project'}</DialogTitle>
        </DialogHeader>

        <div className="-mx-1 -my-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My App" />
          </div>

          <div className="space-y-1.5">
            <Label>Folder</Label>
            <div className="flex gap-2">
              <Input
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="Paste a path or choose a folder…"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void handlePickFolder()}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex items-center gap-3">
              <ProjectIcon
                iconDataUrl={iconDataUrl}
                className="h-12 w-12 border border-border"
                glyphClassName="h-5 w-5"
              />
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
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Website</Label>
            <div className="flex gap-2">
              <Input
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
            <p className="text-xs text-muted-foreground">
              The project's site. Its favicon is downloaded and used as the icon when you don't pick
              an image.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Agent Type</Label>
            <Combobox
              value={agentType}
              onChange={(v) => setAgentType(v as AgentType)}
              options={AGENT_TYPES.map((a) => ({ value: a.value, label: a.label }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>AI CLI</Label>
            <Combobox
              value={cliId}
              onChange={setCliId}
              options={[
                { value: APP_DEFAULT_CLI, label: 'App default (from Settings)' },
                ...CLI_REGISTRY.map((cli) => ({ value: cli.id, label: cli.name })),
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Which CLI this project's AI actions (tag suggestions, version bumps) run through.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Tags (comma separated)</Label>
            <Input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="frontend, web"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label>Run command</Label>
            <Input
              value={runCommand}
              onChange={(e) => setRunCommand(e.target.value)}
              placeholder="npm run dev"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!canSubmit || isSubmitting} onClick={handleSubmit}>
            {initial ? 'Save changes' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
