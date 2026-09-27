/**
 * Text with its matched stretches picked out. `offset` is where `text` starts inside the string
 * the ranges were measured on, so a folder path or a cut-down line can reuse a match's ranges.
 */
export function Highlighted({
  text,
  offset = 0,
  ranges,
}: {
  text: string;
  offset?: number;
  ranges: readonly (readonly [number, number])[];
}): React.JSX.Element {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    const from = Math.max(start - offset, 0);
    const to = Math.min(end - offset, text.length);
    if (to <= from || to <= at) continue;
    if (from > at) parts.push(text.slice(at, from));
    parts.push(
      <mark key={from} className="rounded-[2px] bg-primary/25 text-foreground">
        {text.slice(Math.max(from, at), to)}
      </mark>,
    );
    at = to;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
