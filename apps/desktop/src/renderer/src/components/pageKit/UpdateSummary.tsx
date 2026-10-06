/**
 * The body of an "Update X?" dialog: the two versions as hairline rows, and the command that
 * will be typed into the terminal.
 */
export function UpdateSummary({
  currentVersion,
  latestVersion,
  command,
}: {
  currentVersion: string | null;
  latestVersion: string;
  command: string;
}): React.JSX.Element {
  return (
    <div className="space-y-2 text-sm">
      <div className="settings-rows rounded-lg bg-foreground/[0.04]">
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          <span className="text-muted-foreground">Current version</span>
          <span className="font-mono text-xs">{currentVersion ?? 'unknown'}</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          <span className="text-muted-foreground">Latest version</span>
          <span className="font-mono text-xs font-semibold text-primary">{latestVersion}</span>
        </div>
      </div>
      <code className="block overflow-x-auto whitespace-pre rounded-lg bg-foreground/[0.05] px-3 py-2 font-mono text-xs">
        {command}
      </code>
    </div>
  );
}
