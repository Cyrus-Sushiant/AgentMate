/**
 * Stand-ins for the Monaco editors in the Websites tests: a plain text box that reports edits and
 * shows its marks as text, and a diff that shows both sides.
 */

export function FakeMonacoEditor({
  value,
  onChange,
  readOnly,
  markers,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  markers?: ReadonlyArray<{ line: number; message: string }>;
}): React.JSX.Element {
  return (
    <div>
      <textarea
        aria-label="Snippet editor"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <span data-testid="marks">
        {(markers ?? []).map((mark) => `${mark.line}:${mark.message}`).join('|')}
      </span>
    </div>
  );
}

export function FakeMonacoDiffEditor({
  original,
  modified,
}: {
  original: string;
  modified: string;
}): React.JSX.Element {
  return (
    <pre data-testid="snippet-diff">
      {original} =&gt; {modified}
    </pre>
  );
}
