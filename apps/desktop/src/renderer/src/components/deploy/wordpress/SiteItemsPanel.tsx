import type { Project, ProjectWordPressItemKind, WpItem, WpItemRef } from '@agentmat/core';
import type { DeployWordPressSite, DeployWordPressSiteInfo } from '@shared/deployWordPressTypes';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Blocks,
  Bolt,
  CloudDownload,
  CloudUpload,
  FolderPlus,
  Lock,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from '@/components/icons';
import { Chip } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { DeployFlowDialog } from '@/components/wordpress/DeployFlowDialog';
import { PullFlowDialog } from '@/components/wordpress/PullFlowDialog';
import { DeployCard, Notice } from '../deployKit';
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
    <li className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-medium text-foreground">{item.name}</span>
          {item.active && (
            <Chip tone="success" dot>
              Active
            </Chip>
          )}
          {item.networkActive && (
            <Chip tone="success" dot>
              Network active
            </Chip>
          )}
          {item.protected && <Chip>Connector</Chip>}
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
            <Button size="sm" variant="soft" onClick={onNewProject}>
              <FolderPlus /> Make a WordPress project
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
                  variant="soft"
                  aria-label={`Pull ${item.name} into ${project.name}`}
                  onClick={() => onOpen({ kind: 'pull', projectId: project.id, item: ref })}
                >
                  <CloudDownload /> Pull
                </Button>
                <SimpleTooltip label={deployBlocked} wrapTrigger>
                  <Button
                    size="sm"
                    disabled={deployBlocked !== null}
                    aria-label={`Review and deploy ${item.name} from ${project.name}`}
                    onClick={() => onOpen({ kind: 'deploy', projectId: project.id, item: ref })}
                  >
                    <CloudUpload /> Review and deploy
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
    <div className="flex flex-col gap-2">
      {siteBlock && (
        <Notice role="note" icon={Lock}>
          {siteBlock}
        </Notice>
      )}
      {itemsQuery.isError && (
        <div className="flex flex-col items-start gap-2">
          <div className="w-full">
            <SetupFailure message={wpProblem(itemsQuery.error)} />
          </div>
          <Button
            size="sm"
            variant="soft"
            disabled={itemsQuery.isFetching}
            onClick={() => void itemsQuery.refetch()}
          >
            <RefreshCw /> Try again
          </Button>
        </div>
      )}
      {projectsQuery.isError && (
        <Notice tone="warning" icon={TriangleAlert}>
          Your projects did not load, so the links to them are missing.
        </Notice>
      )}
      {!itemsQuery.isError &&
        GROUPS.map((group) => {
          const items = (itemsQuery.data ?? []).filter((item) => item.kind === group.kind);
          return (
            <DeployCard
              key={group.kind}
              icon={
                group.kind === 'theme' ? (
                  <Sparkles />
                ) : group.kind === 'mu-plugin' ? (
                  <Bolt />
                ) : (
                  <Blocks />
                )
              }
              title={group.title}
              extra={
                itemsQuery.isPending ? undefined : (
                  <Chip className="tabular-nums">{items.length}</Chip>
                )
              }
              description={
                group.kind === 'mu-plugin'
                  ? "Loaded on every request and can't be switched off in wp-admin."
                  : undefined
              }
            >
              {itemsQuery.isPending ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{group.empty}</p>
              ) : (
                <ul aria-label={group.title} className="settings-rows">
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
            </DeployCard>
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
