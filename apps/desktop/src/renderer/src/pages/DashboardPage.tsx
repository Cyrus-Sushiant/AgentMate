import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Blocks,
  FolderKanban,
  RefreshCw,
  Sparkles,
  TerminalSquare,
  FolderPlus,
} from '@/components/icons';
import { CLI_REGISTRY } from '@agentmat/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { queryKeys } from '@/lib/queryKeys';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cliQuery = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const activityQuery = useQuery({
    queryKey: queryKeys.activity,
    queryFn: () => window.agentmat.activity.list(),
  });
  const reposQuery = useQuery({
    queryKey: queryKeys.repositories,
    queryFn: () => window.agentmat.skills.listRepositories(),
  });

  const installedCount = cliQuery.data?.filter((c) => c.installed).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your AI CLIs, projects, and activity at a glance.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/projects?new=1')}>
          <FolderPlus /> New Project
        </Button>
        <Button variant="secondary" onClick={() => navigate('/prompt-builder')}>
          <Sparkles /> Open Prompt Builder
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.cliStatus });
            toast.info('Re-scanning installed CLIs…');
          }}
        >
          <RefreshCw /> Scan CLIs
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <TerminalSquare className="h-3.5 w-3.5" /> Installed CLIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {installedCount}/{CLI_REGISTRY.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" /> Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{projectsQuery.data?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <Blocks className="h-3.5 w-3.5" /> Skill Repositories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{reposQuery.data?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activityQuery.data?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Installed AI CLIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CLI_REGISTRY.filter((cli) => cliQuery.data?.find((c) => c.id === cli.id)?.installed).map(
              (cli) => {
                const status = cliQuery.data?.find((c) => c.id === cli.id);
                return (
                  <div key={cli.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{cli.name}</div>
                      <div className="text-xs text-muted-foreground">{status?.version}</div>
                    </div>
                    <Badge variant="success">Installed</Badge>
                  </div>
                );
              },
            )}
            {installedCount === 0 && (
              <p className="text-sm text-muted-foreground">
                No AI CLIs detected yet. Visit the{' '}
                <button className="underline underline-offset-2" onClick={() => navigate('/cli-manager')}>
                  CLI Manager
                </button>{' '}
                to install one.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!activityQuery.data || activityQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet — install a CLI or create a project to get started.
              </p>
            ) : (
              activityQuery.data.slice(0, 8).map((event) => (
                <div key={event.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{event.message}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(event.createdAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
