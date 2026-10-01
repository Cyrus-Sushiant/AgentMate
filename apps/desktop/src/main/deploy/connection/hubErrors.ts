/**
 * The human part of a hub error. SignalR puts what the core said after "HubException: ", behind
 * a sentence of its own about where it happened.
 */
export function hubMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const marker = message.indexOf('HubException: ');
  return marker < 0 ? message : message.slice(marker + 'HubException: '.length);
}
