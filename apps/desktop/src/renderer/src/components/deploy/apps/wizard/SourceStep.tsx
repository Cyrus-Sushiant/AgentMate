import { coreErrorMessage } from '@shared/coreErrors';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { Field, NativeSelect, Problem } from '@/components/cloudflare/fields';
import { FileCode } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import type { WizardSource } from './types';

/** Where the app comes from: a project, one of its compose files, an environment, and a name. */

export function SourceStep({
  source,
  nameProblem,
  nameLocked,
  onChange,
}: {
  source: WizardSource;
  nameProblem: string | null;
  /** Deploying again keeps the app's name. */
  nameLocked: boolean;
  onChange: (next: Partial<WizardSource>, touchedName?: boolean) => void;
}): React.JSX.Element {
  const ids = useId();
  const projects = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const discovery = useQuery({
    queryKey: queryKeys.deployComposeFiles(source.projectId),
    queryFn: () => window.agentmat.deployStacks.discover(source.projectId),
    enabled: source.projectId !== '',
    retry: false,
  });
  const environments = useQuery({
    queryKey: queryKeys.projectEnvironments(source.projectId),
    queryFn: () => window.agentmat.environments.list(source.projectId),
    enabled: source.projectId !== '',
  });

  const files = discovery.data?.files ?? [];

  return (
    <div className="space-y-5">
      <Field label="Project" htmlFor={`${ids}-project`}>
        {projects.isPending ? (
          <Skeleton className="h-9 w-full" aria-busy="true" />
        ) : (
          <NativeSelect
            id={`${ids}-project`}
            value={source.projectId}
            onChange={(event) => {
              const project = projects.data?.find((item) => item.id === event.target.value);
              onChange({
                projectId: event.target.value,
                projectName: project?.name ?? '',
                projectFolder: project?.folderPath ?? '',
                composePath: '',
                environmentId: null,
              });
            }}
          >
            <option value="">Pick a project</option>
            {(projects.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      {source.projectId !== '' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Compose file</legend>
          {discovery.isPending ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : discovery.isError ? (
            <Problem
              message={`The project's compose files could not be listed: ${coreErrorMessage(discovery.error)}`}
              onRetry={() => void discovery.refetch()}
            />
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This project has no compose.yaml or docker-compose.yml. Add one to the project and
              come back.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Compose file" className="space-y-1.5">
              {files.map((file) => {
                const unreadable = file.error !== undefined;
                const checked = source.composePath === file.path;
                return (
                  <label
                    key={file.path}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors',
                      checked
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-foreground/20',
                      unreadable && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${ids}-compose`}
                      value={file.path}
                      checked={checked}
                      disabled={unreadable}
                      onChange={() => onChange({ composePath: file.path })}
                      className="mt-1 accent-[hsl(var(--primary))]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-mono text-sm text-foreground">
                        <FileCode className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {file.path}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {unreadable
                          ? file.error
                          : file.services === null
                            ? 'Services unknown'
                            : file.services === 1
                              ? '1 service'
                              : `${file.services} services`}
                      </span>
                    </span>
                  </label>
                );
              })}
              {discovery.data?.truncated && (
                <p className="text-xs text-muted-foreground">
                  The project is large, so a compose file deep inside it may be missing here.
                </p>
              )}
            </div>
          )}
        </fieldset>
      )}

      {source.projectId !== '' && (
        <Field
          label="Environment"
          htmlFor={`${ids}-environment`}
          hint="Its files become the app's .env on the server. Values stay out of this window."
        >
          <NativeSelect
            id={`${ids}-environment`}
            value={source.environmentId ?? ''}
            disabled={environments.isPending}
            onChange={(event) => {
              const environment = environments.data?.find((item) => item.id === event.target.value);
              onChange({
                environmentId: event.target.value === '' ? null : event.target.value,
                environmentName: environment?.name ?? null,
              });
            }}
          >
            <option value="">No environment</option>
            {(environments.data ?? []).map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.name}
                {environment.files.length === 0 ? ' (no files)' : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      <Field
        label="App name"
        htmlFor={`${ids}-name`}
        hint={
          nameLocked
            ? 'Deploying again keeps the name.'
            : 'The compose project name on the server: lowercase letters, digits, dashes and underscores.'
        }
      >
        <Input
          id={`${ids}-name`}
          value={source.name}
          readOnly={nameLocked}
          aria-invalid={nameProblem !== null}
          aria-describedby={nameProblem ? `${ids}-name-problem` : undefined}
          onChange={(event) => onChange({ name: event.target.value }, true)}
          className="font-mono"
          spellCheck={false}
        />
        {nameProblem && (
          <p id={`${ids}-name-problem`} className="text-xs text-destructive">
            {nameProblem}
          </p>
        )}
      </Field>
    </div>
  );
}
