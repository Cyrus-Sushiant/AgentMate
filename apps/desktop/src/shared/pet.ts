export interface PetWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Hit box for each companion on the overlay. */
export const PET_BOX = 120;

/** Durations the pet's right-click menu offers for hiding it for a while. */
export const PET_SNOOZE_OPTIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 180, label: '3 hours' },
] as const;

/** Upper bound on a hide, so a bad value can never park the pet for good. */
export const PET_SNOOZE_MAX_MINUTES = 24 * 60;

export interface PetSnoozeState {
  /** Epoch ms when the pet comes back, or null when it is not hidden. */
  until: number | null;
}

/** The run a pet message is about, so opening the app can land straight on it. */
export interface PetPipelineRunRef {
  runId: number;
  /** owner/repo, matching the rows on the Pipelines page. */
  repo: string;
  /**
   * Set when a click should land on the Pipelines section of this project's Workspace instead
   * of the Pipelines page.
   */
  workspaceProjectId?: string;
}

export interface PetPipelineMessage {
  kind: 'pass' | 'fail' | 'warn';
  petName: string;
  text: string;
  projectName?: string;
  workflowName?: string;
  /** Set on failures the watcher raised, so the bubble can open that run. */
  run?: PetPipelineRunRef;
}

/** A project's Workspace with the Pipelines section of its Git panel unfolded. */
export function workspacePipelinesRoute(projectId: string): string {
  return `/workspace/${encodeURIComponent(projectId)}?panel=pipelines`;
}

/**
 * Where a pipeline failure's click goes: the project's Workspace when the ref asks for it,
 * otherwise the route the Pipelines page uses to show one run, picked out of the list.
 */
export function pipelineRunRoute(run: PetPipelineRunRef): string {
  if (run.workspaceProjectId) return workspacePipelinesRoute(run.workspaceProjectId);
  const params = new URLSearchParams({ run: String(run.runId), repo: run.repo });
  return `/pipelines?${params.toString()}`;
}
