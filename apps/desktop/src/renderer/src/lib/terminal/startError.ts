/**
 * What a terminal pane prints when its shell never started. The backend's own reason travels
 * with the rejection (a shell that is not installed, a folder that is gone), so it is shown
 * after the familiar line rather than swallowed: without it every failure looks the same and
 * a bug report has nothing to go on.
 */
export function describeTerminalStartError(error: unknown): string {
  const detail = error instanceof Error ? error.message.trim() : '';
  return detail ? `Could not start this terminal. ${detail}` : 'Could not start this terminal.';
}
