import { useId } from 'react';
import { cn } from '@/lib/utils';
import { FieldError, Section, TextField, ToggleRow } from './fields';
import type { SiteTabProps } from './tabTypes';

/** Where nginx sends the site's visitors: a port on this server, or another address. */

const KINDS = [
  {
    value: 'servicePort',
    label: 'A port on this server',
    description: 'An app or stack service listening on 127.0.0.1.',
  },
  {
    value: 'url',
    label: 'An address',
    description: 'Any http:// or https:// URL nginx can reach.',
  },
] as const;

export function ProxyTab({ draft, set, error, readOnly }: SiteTabProps): React.JSX.Element {
  const group = useId();
  return (
    <div className="space-y-4">
      <Section title="Upstream" description="Where nginx passes each request it receives.">
        <div role="radiogroup" aria-labelledby={group} className="grid gap-2 sm:grid-cols-2">
          <span id={group} className="sr-only">
            Upstream kind
          </span>
          {KINDS.map((kind) => {
            const chosen = draft.upstreamKind === kind.value;
            return (
              <button
                key={kind.value}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={readOnly}
                onClick={() => set({ upstreamKind: kind.value })}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                  chosen ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span
                    aria-hidden
                    className={cn(
                      'h-3 w-3 rounded-full border',
                      chosen ? 'border-primary bg-primary' : 'border-muted-foreground',
                    )}
                  />
                  {kind.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{kind.description}</span>
              </button>
            );
          })}
        </div>
        {draft.upstreamKind === 'servicePort' ? (
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <TextField
              label="Service name"
              value={draft.service}
              onChange={(service) => set({ service })}
              hint="Shown on the route map. Leave empty for a plain local port."
              placeholder="web"
              disabled={readOnly}
              mono
            />
            <TextField
              label="Port"
              value={draft.port}
              onChange={(port) => set({ port })}
              placeholder="3000"
              inputMode="numeric"
              disabled={readOnly}
              mono
            />
          </div>
        ) : (
          <TextField
            label="Address"
            value={draft.url}
            onChange={(url) => set({ url })}
            placeholder="http://10.0.0.5:8080"
            inputMode="url"
            disabled={readOnly}
            mono
          />
        )}
        <FieldError message={error('upstream')} />
        {draft.upstreamKind === 'url' && (
          <>
            <ToggleRow
              label="Check the upstream's certificate"
              description="For https:// addresses. Turn off only for a self-signed certificate you trust."
              checked={draft.verifyCertificate}
              onChange={(verifyCertificate) => set({ verifyCertificate })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Send the upstream's own host name"
              description="Instead of the domain the visitor asked for. Some hosted services need this."
              checked={draft.sendUpstreamHost}
              onChange={(sendUpstreamHost) => set({ sendUpstreamHost })}
              disabled={readOnly}
            />
          </>
        )}
      </Section>
      <Section title="Connections">
        <ToggleRow
          label="WebSockets"
          description="Lets live connections (chat, dashboards, hot reload) through to the app."
          checked={draft.websocket}
          onChange={(websocket) => set({ websocket })}
          disabled={readOnly}
        />
      </Section>
    </div>
  );
}
