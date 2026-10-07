import { TriangleAlert } from '@/components/icons';
import { Notice } from './deployKit';

/** The installer appends the core's last log lines after this line. */
const JOURNAL_MARK = '\n\nWhat the core logged:\n';

/** Why an install or removal stopped, with the core's own log lines folded away below it. */
export function SetupFailure({ message }: { message: string }): React.JSX.Element {
  const mark = message.indexOf(JOURNAL_MARK);
  const summary = mark < 0 ? message : message.slice(0, mark);
  const journal = mark < 0 ? null : message.slice(mark + JOURNAL_MARK.length);
  return (
    <Notice role="alert" tone="destructive" icon={TriangleAlert}>
      <p className="whitespace-pre-wrap break-words">{summary}</p>
      {journal && (
        <details className="mt-2">
          <summary className="cursor-pointer rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            What the core logged
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-foreground/[0.05] p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {journal}
          </pre>
        </details>
      )}
    </Notice>
  );
}
