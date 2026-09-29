import { TriangleAlert } from '@/components/icons';

/** The installer appends the core's last log lines after this line. */
const JOURNAL_MARK = '\n\nWhat the core logged:\n';

/** Why an install or removal stopped, with the core's own log lines folded away below it. */
export function SetupFailure({ message }: { message: string }): React.JSX.Element {
  const mark = message.indexOf(JOURNAL_MARK);
  const summary = mark < 0 ? message : message.slice(0, mark);
  const journal = mark < 0 ? null : message.slice(mark + JOURNAL_MARK.length);
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span className="whitespace-pre-wrap break-words">{summary}</span>
      </p>
      {journal && (
        <details className="mt-2 pl-6">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            What the core logged
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {journal}
          </pre>
        </details>
      )}
    </div>
  );
}
