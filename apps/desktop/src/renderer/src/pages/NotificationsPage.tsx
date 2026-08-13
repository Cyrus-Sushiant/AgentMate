import type { AppNotification } from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CircleCheck,
  ExternalLink,
  FolderKanban,
  Trash2,
  TriangleAlert,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { usePageHeader } from '@/stores/pageHeaderStore';

export default function NotificationsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  usePageHeader('Notifications', 'Pipeline failures from GitHub Actions you connected.');

  const listQuery = useQuery({
    queryKey: queryKeys.appNotifications,
    queryFn: () => window.agentmat.pipelines.listNotifications(),
  });

  useEffect(() => {
    return window.agentmat.pipelines.onNotificationsChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
    });
  }, [queryClient]);

  const markRead = useMutation({
    mutationFn: (id: string) => window.agentmat.pipelines.markRead(id),
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.appNotifications, items);
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => window.agentmat.pipelines.markAllRead(),
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.appNotifications, items);
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
    },
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => window.agentmat.pipelines.removeNotification(id),
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.appNotifications, items);
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
    },
  });

  const items = listQuery.data ?? [];
  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="flex min-h-full flex-1 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Watched pipelines write a note here when they fail. Passing runs stay on the Git tab.
          </p>
        </div>
        {unread > 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <Check className="h-3.5 w-3.5" /> Mark all read
          </Button>
        ) : null}
      </div>

      {listQuery.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="glass h-20 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No pipeline failures</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Connect GitHub Actions on a project&apos;s Git tab. When a watched pipeline fails, it
              shows up here.
            </p>
          </div>
        </div>
      ) : (
        <ol className="space-y-2">
          {items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onOpenProject={() => {
                if (item.projectId) navigate(`/projects/${item.projectId}?tab=git`);
              }}
              onOpenRun={() => {
                if (!item.read) markRead.mutate(item.id);
                if (item.htmlUrl) void window.agentmat.shell.openExternal(item.htmlUrl);
              }}
              onMarkRead={() => markRead.mutate(item.id)}
              onRemove={() => removeItem.mutate(item.id)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  onOpenProject,
  onOpenRun,
  onMarkRead,
  onRemove,
}: {
  item: AppNotification;
  onOpenProject: () => void;
  onOpenRun: () => void;
  onMarkRead: () => void;
  onRemove: () => void;
}): React.JSX.Element {
  return (
    <li
      className={cn(
        'glass relative overflow-hidden rounded-xl p-4',
        !item.read && 'ring-1 ring-destructive/35',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          item.read ? 'bg-border' : 'bg-destructive',
        )}
        aria-hidden
      />
      <div className="flex items-start gap-3 pl-2">
        <span
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            item.read ? 'bg-foreground/[0.06] text-muted-foreground' : 'bg-destructive/15 text-destructive',
          )}
        >
          {item.read ? <CircleCheck className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{item.title}</p>
            {!item.read ? <Badge variant="destructive">New</Badge> : null}
            <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{item.body}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {item.htmlUrl ? (
              <Button variant="outline" size="sm" onClick={onOpenRun}>
                <ExternalLink className="h-3.5 w-3.5" /> Open run
              </Button>
            ) : null}
            {item.projectId ? (
              <Button variant="ghost" size="sm" onClick={onOpenProject}>
                <FolderKanban className="h-3.5 w-3.5" /> {item.projectName}
              </Button>
            ) : null}
            {!item.read ? (
              <Button variant="ghost" size="sm" onClick={onMarkRead}>
                <Check className="h-3.5 w-3.5" /> Mark read
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onRemove} aria-label="Remove notification">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
