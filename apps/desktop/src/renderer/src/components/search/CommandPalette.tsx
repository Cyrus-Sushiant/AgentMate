import { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Blocks, Folder, History, Search } from '@/components/icons';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useSearchStore } from '@/stores/searchStore';
import { NAV_ITEMS } from '@/components/layout/Sidebar';

export function CommandPalette(): React.JSX.Element {
  const open = useSearchStore((s) => s.open);
  const setOpen = useSearchStore((s) => s.setOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
    enabled: open,
  });
  const historyQuery = useQuery({
    queryKey: queryKeys.promptHistory,
    queryFn: () => window.agentmat.promptHistory.list(),
    enabled: open,
  });
  const reposQuery = useQuery({
    queryKey: queryKeys.repositories,
    queryFn: () => window.agentmat.skills.listRepositories(),
    enabled: open,
  });
  const repoIndexQueries = useQueries({
    queries: (reposQuery.data ?? []).map((repo) => ({
      queryKey: queryKeys.repositoryIndex(repo.id),
      queryFn: () => window.agentmat.skills.getRepositoryIndex(repo.id),
      enabled: open,
    })),
  });

  const skillResults = useMemo(() => {
    const repos = reposQuery.data ?? [];
    return repoIndexQueries.flatMap((q, i) => {
      const repo = repos[i];
      if (!repo || !q.data) return [];
      return q.data.skills.map((skill) => ({ skill, repo }));
    });
  }, [repoIndexQueries, reposQuery.data]);

  function selectPage(to: string): void {
    setOpen(false);
    navigate(to);
  }

  function selectProject(id: string): void {
    setOpen(false);
    navigate(`/projects/${id}`);
  }

  function selectHistoryEntry(id: string): void {
    setOpen(false);
    navigate('/prompt-history', { state: { openEntryId: id } });
  }

  function selectSkill(repositoryId: string, skillName: string): void {
    setOpen(false);
    navigate('/skills', { state: { repositoryId, query: skillName } });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-[14%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg',
            'border border-border/60 bg-popover/60 text-popover-foreground shadow-2xl backdrop-blur-2xl backdrop-saturate-150',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search AgentMate</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search projects, prompt history, and skills.
          </DialogPrimitive.Description>
          <CommandPrimitive className="flex flex-col" loop>
            <div className="flex items-center gap-2 border-b border-border/60 px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <CommandPrimitive.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search projects, prompt history, skills…"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
                Esc
              </kbd>
            </div>
            <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto p-2">
              <CommandPrimitive.Empty className="py-10 text-center text-sm text-muted-foreground">
                No results found.
              </CommandPrimitive.Empty>

              <CommandPrimitive.Group
                heading="Pages"
                className="px-1 py-1 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {NAV_ITEMS.map((item) => (
                  <CommandPrimitive.Item
                    key={item.to}
                    value={`page ${item.label}`}
                    onSelect={() => selectPage(item.to)}
                    className="flex cursor-default select-none items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {item.label}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>

              {(projectsQuery.data?.length ?? 0) > 0 && (
                <CommandPrimitive.Group
                  heading="Projects"
                  className="px-1 py-1 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                >
                  {projectsQuery.data!.map((project) => (
                    <CommandPrimitive.Item
                      key={project.id}
                      value={`project ${project.name} ${project.description} ${project.folderPath} ${project.tags.join(' ')}`}
                      onSelect={() => selectProject(project.id)}
                      className="flex cursor-default select-none items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate">{project.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{project.folderPath}</div>
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {(historyQuery.data?.length ?? 0) > 0 && (
                <CommandPrimitive.Group
                  heading="Prompt History"
                  className="px-1 py-1 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                >
                  {historyQuery.data!.map((entry) => (
                    <CommandPrimitive.Item
                      key={entry.id}
                      value={`history ${entry.promptType} ${entry.targetAI} ${entry.content} ${entry.tags.join(' ')}`}
                      onSelect={() => selectHistoryEntry(entry.id)}
                      className="flex cursor-default select-none items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate">
                          {entry.promptType} · {entry.targetAI}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{entry.content}</div>
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {skillResults.length > 0 && (
                <CommandPrimitive.Group
                  heading="Skills"
                  className="px-1 py-1 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                >
                  {skillResults.map(({ skill, repo }) => (
                    <CommandPrimitive.Item
                      key={`${repo.id}-${skill.id}`}
                      value={`skill ${skill.name} ${skill.description} ${skill.category} ${skill.tags.join(' ')}`}
                      onSelect={() => selectSkill(repo.id, skill.name)}
                      className="flex cursor-default select-none items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <Blocks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate">{skill.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{skill.description}</div>
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
