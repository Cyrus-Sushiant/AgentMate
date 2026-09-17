import type { AppNotification } from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Bell } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

/**
 * The app-wide notification bell: pipeline failures and CLI/tool update alerts both land in
 * the same inbox (`appNotifications`), so this reads it directly rather than caring which
 * kind produced an entry.
 */
export function NotificationBell(): React.JSX.Element {
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: queryKeys.appNotificationUnread,
    queryFn: () => window.agentmat.appNotifications.unreadCount(),
    refetchInterval: 60_000,
  });
  const listQuery = useQuery({
    queryKey: queryKeys.appNotifications,
    queryFn: () => window.agentmat.appNotifications.list(),
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

  function handleOpen(item: AppNotification): void {
    if (!item.read) markRead.mutate(item.id);
    if (item.htmlUrl) void window.agentmat.shell.openExternal(item.htmlUrl);
  }

  return (
    <Popover>
      <SimpleTooltip label="Notifications">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span
                data-testid="notification-bell-count"
                className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
      </SimpleTooltip>
      <PopoverContent align="end" aria-label="Notifications" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
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
        <div className="max-h-80 overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpen(item)}
                className={cn(
                  'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-foreground/[0.05]',
                  !item.read && 'bg-primary/5',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {timeAgo(item.createdAt)}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">{item.body}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
