import { checkDirectTlsPort, checkSources } from '@shared/deploy/directTlsValidation';
import { useState } from 'react';
import { Lock, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * The port and the addresses allowed to reach it. Checked as the user types, with the same rules
 * the main process and the core apply again. Saving asks for a step-up when the last one ran out.
 */
export function DirectTlsForm({
  initialPort,
  initialSources,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialPort: number;
  initialSources: string[];
  busy: boolean;
  submitLabel: string;
  onSubmit: (port: number, sources: string[]) => void;
  onCancel?: () => void;
}): React.JSX.Element {
  const [port, setPort] = useState(String(initialPort));
  const [sources, setSources] = useState(initialSources.join('\n'));
  const [touched, setTouched] = useState(false);
  const portCheck = checkDirectTlsPort(port);
  const sourcesCheck = checkSources(sources);
  const valid = portCheck.ok && sourcesCheck.ok;

  return (
    <form
      className="space-y-4"
      aria-label="Direct TLS settings"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (portCheck.ok && sourcesCheck.ok) onSubmit(portCheck.value, sourcesCheck.value);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="direct-tls-port">Port</Label>
          <Input
            id="direct-tls-port"
            inputMode="numeric"
            value={port}
            onChange={(event) => setPort(event.target.value)}
            aria-invalid={touched && !portCheck.ok}
            aria-describedby="direct-tls-port-hint"
          />
          <p id="direct-tls-port-hint" className="text-xs text-muted-foreground">
            {touched && !portCheck.ok ? portCheck.reason : 'TCP, 1024 to 65535.'}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="direct-tls-sources">Allowed from</Label>
          <Textarea
            id="direct-tls-sources"
            rows={3}
            value={sources}
            placeholder={'203.0.113.7\n10.0.0.0/8'}
            onChange={(event) => setSources(event.target.value)}
            aria-invalid={touched && !sourcesCheck.ok}
            aria-describedby="direct-tls-sources-hint"
            className="font-mono text-xs"
          />
          <p id="direct-tls-sources-hint" className="text-xs text-muted-foreground">
            {touched && !sourcesCheck.ok
              ? sourcesCheck.reason
              : 'Addresses or networks, one per line. Leave it empty to allow every address; the client certificate is still required.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || (touched && !valid)}>
          {busy ? (
            <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="soft" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Opening a port asks for your password again if you have not confirmed it in the last 10
          minutes.
        </span>
      </div>
    </form>
  );
}
