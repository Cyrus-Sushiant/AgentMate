import type { AppNotification } from '@agentmat/core';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { openMessageLink, pipelineRunRoute } from '@/lib/messageLink';
import { showLinkedToast } from '@/lib/toastHistory';
import type { ToastHistoryKind, ToastHistoryLink } from '@/stores/toastHistoryStore';

const KIND: Record<AppNotification['kind'], { kind: ToastHistoryKind; tag?: string }> = {
  'pipeline-failure': { kind: 'error', tag: 'Failed' },
  'pipeline-success': { kind: 'success', tag: 'Passed' },
  'tool-update-available': { kind: 'info' },
};

/**
 * Turns inbox entries (pipeline results, CLI updates) into in-app messages: a toast when
 * one arrives, and a row in Recent messages after. What was already in the inbox at
 * startup is left alone, only entries that show up while the app is open are announced.
 */
export function useAppNotificationMessages(): void {
  const navigate = useNavigate();

  useEffect(() => {
    let disposed = false;
    let primed = false;
    const seen = new Set<string>();
    // One sync at a time, so a change landing mid-load cannot announce an entry twice.
    let chain: Promise<void> = Promise.resolve();

    async function sync(): Promise<void> {
      const items = await window.agentmat.appNotifications.list();
      if (disposed) return;
      const fresh = items.filter((item) => !seen.has(item.id));
      for (const item of items) seen.add(item.id);
      if (!primed) {
        primed = true;
        return;
      }
      // The inbox is newest first; announce oldest first so the newest ends up on top.
      for (const item of fresh.reverse()) announce(item);
    }

    function announce(item: AppNotification): void {
      const style = KIND[item.kind] ?? KIND['tool-update-available'];
      const route = pipelineRunRoute(item.htmlUrl);
      const link: ToastHistoryLink = { notificationId: item.id };
      if (route) link.route = route;
      else if (item.htmlUrl) link.url = item.htmlUrl;
      showLinkedToast(
        {
          kind: style.kind,
          title: item.title,
          description: item.body,
          link,
          projectId: item.projectId,
          projectName: item.projectName,
          tag: style.tag,
        },
        () => openMessageLink(link, navigate),
      );
    }

    const run = (): void => {
      chain = chain.then(sync).catch(() => undefined);
    };
    run();
    const stop = window.agentmat.appNotifications.onChanged(run);
    return () => {
      disposed = true;
      stop();
    };
  }, [navigate]);
}
