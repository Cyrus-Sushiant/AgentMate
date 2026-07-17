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
