import { useEffect, useState } from 'react';
import { FolderOpen } from '@/components/icons';
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

const AGENT_TYPES: { value: AgentType; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'opencode', label: 'OpenCode' },
  { value: 'codex', label: 'Codex' },
  { value: 'generic', label: 'Generic' },
];

export interface ProjectFormValues {
  name: string;
  folderPath: string;
  description: string;
  tags: string[];
  agentType: AgentType;
  notes: string;
  runCommand: string;
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

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setFolderPath(initial?.folderPath ?? '');
    setDescription(initial?.description ?? '');
    setTagsText(initial?.tags.join(', ') ?? '');
    setAgentType(initial?.agentType ?? 'claude-code');
    setNotes(initial?.notes ?? '');
    setRunCommand(initial?.runCommand ?? '');
  }, [open, initial]);

  async function handlePickFolder(): Promise<void> {
    const picked = await window.agentmat.projects.pickFolder();
    if (picked) setFolderPath(picked);
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
    });
  }

  const canSubmit = name.trim().length > 0 && folderPath.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit project' : 'New project'}</DialogTitle>
        </DialogHeader>

        <div className="-mx-1 space-y-3 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My App" />
          </div>

          <div className="space-y-1.5">
            <Label>Folder</Label>
            <div className="flex gap-2">
              <Input value={folderPath} readOnly placeholder="Choose a folder…" />
              <Button type="button" variant="outline" size="icon" onClick={() => void handlePickFolder()}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
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
            <Label>Tags (comma separated)</Label>
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="frontend, web" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
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
