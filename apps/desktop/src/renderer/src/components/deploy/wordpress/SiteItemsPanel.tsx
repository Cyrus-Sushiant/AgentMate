import type { Project, ProjectWordPressItemKind, WpItem, WpItemRef } from '@agentmat/core';
import type { DeployWordPressSite, DeployWordPressSiteInfo } from '@shared/deployWordPressTypes';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CloudDownload,
  CloudUpload,
  FolderPlus,
  Lock,
  RefreshCw,
  TriangleAlert,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { DeployFlowDialog } from '@/components/wordpress/DeployFlowDialog';
import { PullFlowDialog } from '@/components/wordpress/PullFlowDialog';
import { SetupFailure } from '../SetupFailure';
import { siteProjects, useProjects, useSiteInfo, useSiteItems } from './hooks';
import { fileChangesStatus, SCOPE_SUMMARY, wpProblem } from './messages';

const GROUPS: ReadonlyArray<{ kind: ProjectWordPressItemKind; title: string; empty: string }> = [
  { kind: 'theme', title: 'Themes', empty: 'No themes on this site.' },
  { kind: 'plugin', title: 'Plugins', empty: 'No plugins on this site.' },
  {
    kind: 'mu-plugin',
    title: 'Must-use plugins',
    empty: 'No must-use plugins on this site.',
  },
];

const PROTECTED = "That's the AgentMate Connector itself, which is never pulled or deployed.";

/** Why deploying this item is off right now, or null when it can go ahead. */
export function deployBlockedReason(
  site: Pick<DeployWordPressSite, 'scope'>,
  info: DeployWordPressSiteInfo | undefined,
  item: Pick<WpItem, 'protected' | 'writable'>,
): string | null {
  if (site.scope === 'read') return SCOPE_SUMMARY.read;
  if (info) {
    const status = fileChangesStatus(info, site);
    if (!status.allowed) return status.text;
  }
  if (item.protected) return PROTECTED;
  if (!item.writable) {
    return "PHP can't write to this folder on the site, so it can't be deployed. Check the folder's permissions on the host.";
  }
  return null;
}

function linksItem(project: Project, item: WpItemRef): boolean {
  return (
    project.wordpress?.items.some((one) => one.kind === item.kind && one.slug === item.slug) ??
    false
  );
}

type FlowTarget = { kind: 'deploy' | 'pull'; projectId: string; item: WpItemRef };

function ItemRow({
  item,
  projects,
  deployBlocked,
  onOpen,
  onNewProject,
}: {
  item: WpItem;
  projects: Project[];
  deployBlocked: string | null;
  onOpen: (target: FlowTarget) => void;
  onNewProject: () => void;
}): React.JSX.Element {
  const ref: WpItemRef = { kind: item.kind, slug: item.slug };
  return (
    <li className="grid gap-3 border-t border-border/60 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-medium text-foreground">{item.name}</span>
          {item.active && <Badge variant="success">Active</Badge>}
          {item.networkActive && <Badge variant="success">Network active</Badge>}
          {item.protected && <Badge variant="secondary">Connector</Badge>}
        </div>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {item.slug}
          {item.version ? <span className="font-sans"> · version {item.version}</span> : null}
        </p>
        {item.parentTheme && (
          <p className="text-xs text-muted-foreground">
            A child theme of <span className="font-mono">{item.parentTheme}</span>
          </p>
        )}
      </div>
      <div className="min-w-0">
        {item.protected ? (
          <p className="text-xs text-muted-foreground">{PROTECTED}</p>
        ) : projects.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Not in a project yet.</span>
            <Button size="sm" variant="ghost" onClick={onNewProject}>
              <FolderPlus className="h-3.5 w-3.5" /> Make a WordPress project
            </Button>
          </div>
        ) : (
          <ul aria-label={`Projects with ${item.name}`} className="space-y-2">
            {projects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {project.name}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Pull ${item.name} into ${project.name}`}
                  onClick={() => onOpen({ kind: 'pull', projectId: project.id, item: ref })}
                >
                  <CloudDownload className="h-3.5 w-3.5" /> Pull
                </Button>
                <SimpleTooltip label={deployBlocked} wrapTrigger>
                  <Button
                    size="sm"
                    disabled={deployBlocked !== null}
                    aria-label={`Review and deploy ${item.name} from ${project.name}`}
                    onClick={() => onOpen({ kind: 'deploy', projectId: project.id, item: ref })}
                  >
                    <CloudUpload className="h-3.5 w-3.5" /> Review and deploy
                  </Button>
                </SimpleTooltip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * The site's themes, plugins and mu-plugins: which are active, which projects on this computer
 * hold a copy, and from there a pull or a reviewed deploy. Names come from the site, so they are
 * shown as text only.
 */
export function SiteItemsPanel({ site }: { site: DeployWordPressSite }): React.JSX.Element {
  const navigate = useNavigate();
  const itemsQuery = useSiteItems(site.id);
  const infoQuery = useSiteInfo(site.id);
  const projectsQuery = useProjects();
  const [target, setTarget] = useState<FlowTarget | null>(null);
  const [flowOpen, setFlowOpen] = useState(false);

  const info = infoQuery.data;
  const linked = siteProjects(projectsQuery.data, site.id);
  const siteBlock =
    site.scope === 'read'
      ? SCOPE_SUMMARY.read
      : info && !fileChangesStatus(info, site).allowed
        ? fileChangesStatus(info, site).text
        : null;

  function open(next: FlowTarget): void {
    setTarget(next);
    setFlowOpen(true);
  }

  const newProject = () => navigate('/projects?new=wordpress');

  return (
    <div className="space-y-4">
      {siteBlock && (
        <div
          role="note"
          className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{siteBlock}</span>
        </div>
      )}
      {itemsQuery.isError && (
        <div className="space-y-3">
          <SetupFailure message={wpProblem(itemsQuery.error)} />
          <Button
            size="sm"
            variant="outline"
            disabled={itemsQuery.isFetching}
            onClick={() => void itemsQuery.refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      )}
      {projectsQuery.isError && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="h-3.5 w-3.5 text-warning" /> Your projects did not load, so the
          links to them are missing.
        </p>
      )}
      {!itemsQuery.isError &&
        GROUPS.map((group) => {
          const items = (itemsQuery.data ?? []).filter((item) => item.kind === group.kind);
          return (
            <Card key={group.kind} className="glass">
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
                {group.kind === 'mu-plugin' && (
                  <CardDescription>
                    Loaded on every request and can't be switched off in wp-admin.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {itemsQuery.isPending ? (
                  <div className="space-y-2" aria-busy="true">
                    {Array.from({ length: 3 }, (_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{group.empty}</p>
                ) : (
                  <ul aria-label={group.title}>
                    {items.map((item) => (
                      <ItemRow
                        key={`${item.kind}/${item.slug}`}
                        item={item}
                        projects={linked.filter((project) => linksItem(project, item))}
                        deployBlocked={deployBlockedReason(site, info, item)}
                        onOpen={open}
                        onNewProject={newProject}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      {target?.kind === 'deploy' && (
        <DeployFlowDialog
          open={flowOpen}
          onOpenChange={setFlowOpen}
          projectId={target.projectId}
          siteId={site.id}
          items={[target.item]}
        />
      )}
      {target?.kind === 'pull' && (
        <PullFlowDialog
          open={flowOpen}
          onOpenChange={setFlowOpen}
          projectId={target.projectId}
          siteId={site.id}
          items={[target.item]}
        />
      )}
    </div>
  );
}
