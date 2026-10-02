import type { NginxApplyResult } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { CircleCheck, Play, Spinner, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { type PlacedProblem, placeProblem } from '@/lib/deploy/sites/problems';
import { cn } from '@/lib/utils';

/**
 * Saved changes wait here until they are applied. Applying renders every site, checks it with
 * nginx -t and reloads; when that fails nginx keeps what it ran and the problems are listed, each
 * a link to the field it is about.
 */

export function ApplyBar({
  pending,
  applying,
  admin,
  result,
  onApply,
  onShowProblem,
}: {
  pending: boolean;
  applying: boolean;
  admin: boolean;
  result: NginxApplyResult | null;
  onApply: () => void;
  onShowProblem: (problem: PlacedProblem) => void;
}): React.JSX.Element | null {
  const failed = result !== null && !result.applied;
  if (!pending && !applying && !failed && !(result?.warnings.length ?? 0)) return null;
  const problems = failed ? result.problems.map(placeProblem) : [];
  return (
    <section
      aria-label="Apply changes"
      aria-busy={applying || undefined}
      className={cn(
        'space-y-2 rounded-lg border px-3 py-2.5',
        failed ? 'border-destructive/40 bg-destructive/10' : 'border-warning/40 bg-warning/10',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {applying ? (
          <Spinner className="h-4 w-4 shrink-0 text-muted-foreground motion-safe:animate-spin" />
        ) : failed ? (
          <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />
        )}
        <p role="status" className="min-w-0 flex-1 text-sm text-foreground">
          {applying
            ? 'Applying: checking the configuration and reloading nginx. This can take some 20 seconds.'
            : failed
              ? `nginx kept running what it had. ${result.error ?? 'The new configuration did not pass its check.'}`
              : pending
                ? 'Saved changes are waiting. Apply them to put them live.'
                : 'Applied, with warnings.'}
        </p>
        {admin && (pending || failed) && (
          <Button type="button" size="sm" disabled={applying} onClick={onApply}>
            <Play className="h-3.5 w-3.5" /> {failed ? 'Apply again' : 'Apply changes'}
          </Button>
        )}
      </div>
      {problems.length > 0 && (
        <ul aria-label="Problems" className="space-y-1 pl-7 text-sm">
          {problems.map((problem) => (
            <li key={`${problem.id}:${problem.path}:${problem.message}`}>
              {problem.scope === 'general' ? (
                <span className="text-destructive">{problem.message}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onShowProblem(problem)}
                  className="cursor-pointer text-left text-destructive underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-mono">{problem.id}</span>
                  {problem.line ? `, line ${problem.line}` : ''}: {problem.message}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {result?.warnings.map((warning) => (
        <p key={warning} className="flex items-center gap-2 pl-7 text-xs text-muted-foreground">
          <CircleCheck className="h-3 w-3" /> {warning}
        </p>
      ))}
    </section>
  );
}
