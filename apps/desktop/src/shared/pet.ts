export interface PetWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Hit box for each companion on the overlay. */
export const PET_BOX = 120;

export interface PetPipelineMessage {
  kind: 'pass' | 'fail';
  petName: string;
  text: string;
  projectName: string;
  workflowName: string;
}
