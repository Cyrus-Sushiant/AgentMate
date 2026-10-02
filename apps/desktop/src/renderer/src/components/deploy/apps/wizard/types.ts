/** What the New App wizard has picked so far. */
export interface WizardSource {
  projectId: string;
  projectName: string;
  projectFolder: string;
  composePath: string;
  environmentId: string | null;
  environmentName: string | null;
  name: string;
}

export type WizardStep = 'source' | 'configure' | 'expose' | 'review' | 'deploy';

export const WIZARD_STEPS: ReadonlyArray<{ step: WizardStep; label: string }> = [
  { step: 'source', label: 'Source' },
  { step: 'configure', label: 'Configure' },
  { step: 'expose', label: 'Expose' },
  { step: 'review', label: 'Review' },
  { step: 'deploy', label: 'Deploy' },
];
