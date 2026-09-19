import type { AppNotification, AppNotificationKind, Project } from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CircleCheck, CircleX, Download } from '@/components/icons';
import { ProjectIcon } from '@/components/projects/ProjectIcon';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

interface KindStyle {
  icon: typeof Bell;
  /** Tile shown when the entry has no project icon of its own (a CLI update, say). */
  tile: string;
  /** Pass/fail chip next to the time; null for kinds that have no outcome. */
  chip: { label: string; className: string } | null;
  /** Left edge stripe that colours the row by outcome. */
  stripe: string;
}

const KIND_STYLE: Record<AppNotificationKind, KindStyle> = {
  'pipeline-failure': {
    icon: CircleX,
    tile: 'bg-destructive/15 text-destructive',
    chip: { label: 'Failed', className: 'bg-destructive/15 text-destructive' },
    stripe: 'bg-destructive',
  },
  'pipeline-success': {
    icon: CircleCheck,
    tile: 'bg-success/15 text-success',
    chip: { label: 'Passed', className: 'bg-success/15 text-success' },
    stripe: 'bg-success',
  },
  'tool-update-available': {
    icon: Download,
    tile: 'bg-primary/12 text-primary',
    chip: null,
    stripe: 'bg-primary/60',
  },
};

/** `https://github.com/owner/repo/actions/runs/123` to the pieces the Pipelines page deep-links on. */
function pipelineRunRoute(htmlUrl: string | null): string | null {
  const match = htmlUrl?.match(/^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/actions\/runs\/(\d+)/);
  if (!match) return null;
  return `/pipelines?run=${match[2]}&repo=${encodeURIComponent(match[1])}`;
}

function NotificationAvatar({
  item,
  project,
}: {
  item: AppNotification;
  project: Project | undefined;
}): React.JSX.Element {
  if (project) {
    return (
      <ProjectIcon
        iconDataUrl={project.iconDataUrl}
        bgColor={project.iconBgColor}
        iconColor={project.iconColor}
        className="h-8 w-8 rounded-lg"
        glyphClassName="h-3.5 w-3.5"
      />
    );
  }
  const style = KIND_STYLE[item.kind];
  return (
    <span
      className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', style.tile)}
    >
      <style.icon className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * The app-wide notification bell: pipeline failures and CLI/tool update alerts both land in
 * the same inbox (`appNotifications`), so this reads it directly rather than caring which
 * kind produced an entry.
 */
export function NotificationBell(): React.JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const unreadQuery = useQuery({
    queryKey: queryKeys.appNotificationUnread,
    queryFn: () => window.agentmat.appNotifications.unreadCount(),
    refetchInterval: 60_000,
  });
  const listQuery = useQuery({
    queryKey: queryKeys.appNotifications,
    queryFn: () => window.agentmat.appNotifications.list(),
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });

  useEffect(() => {
    return window.agentmat.appNotifications.onChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotifications });
    });
  }, [queryClient]);

  const markRead = useMutation({
    mutationFn: (id: string) => window.agentmat.appNotifications.markRead(id),
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.appNotifications, items);
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => window.agentmat.appNotifications.markAllRead(),
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.appNotifications, items);
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
    },
  });

  const unread = unreadQuery.data ?? 0;
  const notifications = listQuery.data ?? [];
  const projectsById = useMemo(
    () => new Map((projectsQuery.data ?? []).map((project) => [project.id, project])),
    [projectsQuery.data],
  );

  function handleOpen(item: AppNotification): void {
    if (!item.read) markRead.mutate(item.id);
    // A pipeline run opens on the Pipelines page in the app, which scrolls to it and
    // blinks the row. Anything else with a link (a CLI update) still goes to the browser.
    const route = pipelineRunRoute(item.htmlUrl);
    if (route) {
      setOpen(false);
      navigate(route);
    } else if (item.htmlUrl) {
      void window.agentmat.shell.openExternal(item.htmlUrl);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SimpleTooltip label="Notifications">
        <PopoverTrigger asChild>
          <Button
            variant={open ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Notifications"
            className="relative"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span
                data-testid="notification-bell-count"
                className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
      </SimpleTooltip>
      <PopoverContent align="end" aria-label="Notifications" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 ? (
              <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
                {unread} new
              </span>
            ) : null}
          </div>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto p-1.5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground">
                <Bell className="h-4 w-4" />
              </span>
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((item) => {
              const style = KIND_STYLE[item.kind] ?? KIND_STYLE['tool-update-available'];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpen(item)}
                  className={cn(
                    'relative flex w-full items-start gap-3 overflow-hidden rounded-lg py-2.5 pl-3.5 pr-2.5 text-left transition-colors hover:bg-foreground/[0.05]',
                    !item.read && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn('absolute inset-y-1.5 left-0 w-[3px] rounded-full', style.stripe)}
                    aria-hidden
                  />
                  <NotificationAvatar
                    item={item}
                    project={item.projectId ? projectsById.get(item.projectId) : undefined}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          item.read ? 'font-medium' : 'font-semibold',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
                        {timeAgo(item.createdAt)}
                        {!item.read ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                        ) : null}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{item.body}</span>
                    <span className="flex items-center gap-1.5 pt-0.5">
                      {style.chip ? (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                            style.chip.className,
                          )}
                        >
                          {style.chip.label}
                        </span>
                      ) : null}
                      {item.projectName ? (
                        <span className="truncate text-[11px] font-medium text-muted-foreground/80">
                          {item.projectName}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
