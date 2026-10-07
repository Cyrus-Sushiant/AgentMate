import type { DeployStackPreview } from '@shared/deployStacksTypes';
import { Docker, Package, TriangleAlert } from '@/components/icons';
import { Chip, SECTION_WELL } from '@/components/pageKit';
import { cn } from '@/lib/utils';

/** What the compose file runs and what its environment gives it, keys only. */

export function ConfigureStep({ preview }: { preview: DeployStackPreview }): React.JSX.Element {
  return (
    <div className="space-y-5">
      {preview.blocking && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/[0.06] p-3 text-sm text-foreground ring-1 ring-inset ring-destructive/35"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>This compose file cannot be deployed as it is. {preview.blocking}</span>
        </div>
      )}

      <section aria-labelledby="configure-services" className="space-y-2">
        <h4 id="configure-services" className="text-[13px] font-semibold text-foreground">
          Services
        </h4>
        {preview.services.length === 0 ? (
          <p className="text-sm text-muted-foreground">The compose file has no services.</p>
        ) : (
          <ul aria-label="Services to deploy" className="grid gap-2 sm:grid-cols-2">
            {preview.services.map((service) => (
              <li
                key={service.name}
                aria-label={service.name}
                className={cn(SECTION_WELL, 'flex items-start gap-2 px-3 py-2')}
              >
                {service.builds ? (
                  <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <Docker className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                )}
                <span className="min-w-0">
                  <span className="block font-mono text-sm text-foreground">{service.name}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {service.builds
                      ? service.image
                        ? `builds from the project as ${service.image}`
                        : 'builds from the project'
                      : (service.image ?? 'no image set')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {preview.buildContext && (
          <p className="text-xs text-muted-foreground">
            The project folder goes up with the files, without what .dockerignore leaves out:{' '}
            {preview.buildContext}
          </p>
        )}
      </section>

      <section aria-labelledby="configure-env" className="space-y-2">
        <h4 id="configure-env" className="text-[13px] font-semibold text-foreground">
          Environment
        </h4>
        {preview.envFiles.length > 0 && (
          <p className="text-xs text-muted-foreground">
            From {preview.envFiles.join(', ')}, later files winning. Only the names are shown here.
          </p>
        )}
        {preview.envKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No .env goes with this app.</p>
        ) : (
          <ul aria-label="Env keys" className="flex flex-wrap gap-1">
            {preview.envKeys.map((key) => (
              <li key={key}>
                <Chip className="font-mono">{key}</Chip>
              </li>
            ))}
          </ul>
        )}
        {preview.missingVariables.length > 0 && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-warning/[0.06] px-3 py-2 text-xs text-foreground ring-1 ring-inset ring-warning/30"
          >
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              The compose file uses{' '}
              <span className="font-mono">{preview.missingVariables.join(', ')}</span>, which the
              environment does not set. Compose reads them as empty.
            </span>
          </p>
        )}
      </section>
    </div>
  );
}
