import { PROMPT_TYPE_PROFILES } from './promptTypeProfiles.js';
import { TARGET_AI_NOTES } from './targetAiNotes.js';
import type { GeneratePromptInput } from './types.js';

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function generatePrompt({ rawInput, promptType, targetAI }: GeneratePromptInput): string {
  const profile = PROMPT_TYPE_PROFILES[promptType];
  const trimmedInput = rawInput.trim();
  const aiNote = TARGET_AI_NOTES[targetAI];

  return `# Task Request

## Role
Act as a ${profile.roleLabel}.

## Objective
${trimmedInput || '(describe the task here)'}

## Focus Areas
${bulletList(profile.focusAreas)}

## Requirements
${bulletList(profile.requirements)}

## Constraints
- Keep the change scoped to what was requested; do not add unrelated refactors.
- Preserve existing behavior unless the objective explicitly asks for a change.
- Flag any assumptions made due to missing information.

## Best Practices to Apply
${bulletList(profile.bestPractices)}

## Output Format
- Summarize the approach briefly before making changes.
- Make the changes.
- Summarize what changed and why, and note any follow-up work.

## Notes for ${targetAI}
${aiNote}
`;
}

/**
 * Builds the request sent to the user's configured AI provider so *it* writes the final prompt,
 * rather than filling a fixed local template. Only the (English) task description is inserted
 * verbatim; promptType/targetAI are passed as guidance for the AI, not injected as boilerplate.
 */
export function buildPromptGenerationRequest({
  rawInput,
  promptType,
  targetAI,
}: GeneratePromptInput): string {
  const profile = PROMPT_TYPE_PROFILES[promptType];
  const aiNote = TARGET_AI_NOTES[targetAI];
  const trimmedInput = rawInput.trim();

  return `You are an expert prompt engineer. Write a single, complete, ready-to-use prompt that a developer can paste directly into ${targetAI} to accomplish the task described below.

Task category: ${promptType} (frame the request as if commissioning a ${profile.roleLabel}).
Category guidance — focus areas: ${profile.focusAreas.join(', ')}. Requirements to satisfy: ${profile.requirements.join(', ')}. Best practices to apply: ${profile.bestPractices.join(', ')}.
Notes specific to ${targetAI}: ${aiNote}

Task description:
"""
${trimmedInput}
"""

Write the final prompt now, in clear English, structured for ${targetAI} (e.g. role, objective, requirements, constraints, output format as appropriate). Base it only on the task description above — do not invent unrelated requirements. Output ONLY the prompt text itself, with no preamble, explanation, or surrounding commentary.`;
}
