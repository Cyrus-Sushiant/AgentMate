import { randomUUID } from 'node:crypto';
import type { DeploySiteLogEvent, DeploySiteLogWatchInput } from '../../../shared/deploySitesTypes';
import { IPC } from '../../../shared/ipcChannels';
import type { CoreLinks } from '../live/coreLinks';
import type { SubscriptionOwner } from '../live/subscriptions';
import { DEFAULT_TAIL_LINES, SiteLogFeed } from './siteLogFeed';

/**
 * The windows' live site logs. Each belongs to the window that opened it, sends to that window
 * alone and ends when the window goes away (the IPC layer calls `dropOwner`). Lines go out in
 * batches a moment apart, so a busy access log is a message every 100 ms rather than one a line.
 * What reaches the window is nginx's text as the core passed it on (long lines clipped, control
 * characters made visible); the renderer shows it as plain text.
 */

const FLUSH_MS = 100;
/** The core's own limit is two site logs per connection; the app's windows share one. */
const MAX_PER_SERVER = 2;

export interface SiteLogSubscriptionsDeps {
  links: Pick<CoreLinks, 'attachFeed'>;
  flushMs?: number;
  newId?: () => string;
}

interface Entry {
  ownerId: number;
  serverId: string;
  stop: () => void;
}

export class SiteLogSubscriptions {
  private readonly entries = new Map<string, Entry>();
  private readonly flushMs: number;
  private readonly newId: () => string;

  constructor(private readonly deps: SiteLogSubscriptionsDeps) {
    this.flushMs = deps.flushMs ?? FLUSH_MS;
    this.newId = deps.newId ?? randomUUID;
  }

  watch(owner: SubscriptionOwner, input: DeploySiteLogWatchInput): string {
    const open = [...this.entries.values()].filter((entry) => entry.serverId === input.serverId);
    if (open.length >= MAX_PER_SERVER) {
      throw new Error('Two site logs are already open for this server. Close one first.');
    }
    const id = this.newId();
    let lines: string[] = [];
    let reset = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const send = (ended?: { error?: string }) => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (!ended && lines.length === 0 && !reset) return;
      const event: DeploySiteLogEvent = {
        subscriptionId: id,
        serverId: input.serverId,
        siteId: input.siteId,
        kind: input.kind,
        lines,
        reset,
        ...(ended ? { ended } : {}),
      };
      lines = [];
      reset = false;
      owner.send(IPC.deploySites.onLog, event);
    };
    const feed = new SiteLogFeed(input.siteId, input.kind, input.tailLines ?? DEFAULT_TAIL_LINES, {
      lines: (batch, fromScratch) => {
        if (fromScratch) {
          // Whatever was waiting belongs to the file or stream that is gone.
          lines = [];
          reset = true;
        }
        lines.push(...batch);
        timer ??= setTimeout(() => send(), this.flushMs);
      },
      ended: (end) => {
        send(end);
        this.entries.get(id)?.stop();
        this.entries.delete(id);
      },
    });
    const detach = this.deps.links.attachFeed(input.serverId, feed);
    this.entries.set(id, {
      ownerId: owner.id,
      serverId: input.serverId,
      stop: () => {
        if (timer) clearTimeout(timer);
        timer = null;
        detach();
      },
    });
    return id;
  }

  /** Ends one of the window's own logs. False when it has none by that id. */
  unwatch(owner: SubscriptionOwner, subscriptionId: string): boolean {
    const entry = this.entries.get(subscriptionId);
    if (!entry || entry.ownerId !== owner.id) return false;
    this.entries.delete(subscriptionId);
    entry.stop();
    return true;
  }

  /** Ends every log of a window that closed, reloaded or crashed. */
  dropOwner(ownerId: number): void {
    for (const [id, entry] of [...this.entries]) {
      if (entry.ownerId !== ownerId) continue;
      this.entries.delete(id);
      entry.stop();
    }
  }

  count(): number {
    return this.entries.size;
  }
}
