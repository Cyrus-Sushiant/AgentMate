/** Electron prefixes rejected IPC calls with "Error invoking remote method '...': Error: ". */
export function ipcErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : '';
  return (
    raw
      .replace(/^Error invoking remote method '[^']*':\s*/, '')
      .replace(/^Error:\s*/, '')
      .trim() || fallback
  );
}
