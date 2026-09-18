import { describe, expect, it } from 'vitest';
import { TARGET_AIS } from '../cli/registry.js';
import { PROMPT_TYPE_PROFILES } from './promptTypeProfiles.js';
import { targetAINote } from './targetAiNotes.js';
import { buildPromptGenerationRequest, generatePrompt } from './templateEngine.js';
import { PROMPT_TYPES, type PromptType } from './types.js';

/**
 * `generatePrompt` is what the user gets with no AI provider configured, so it has to
 * produce a complete, paste-ready document on its own. The task description is the
 * only thing inserted verbatim in either builder, which is what keeps a pasted
 * instruction from rewriting the surrounding structure.
 */

describe('generatePrompt', () => {
  it('fills every section from the profile and the target AI', () => {
    expect(
      generatePrompt({
        rawInput: 'Add a dark mode toggle to the settings page',
        promptType: 'Frontend',
        targetAI: 'Claude Code',
      }),
    ).toMatchInlineSnapshot(`
      "# Task Request

      ## Role
      Act as a senior frontend engineer.

      ## Objective
      Add a dark mode toggle to the settings page

      ## Focus Areas
      - Component structure
      - State management
      - Responsive layout
      - Accessibility

      ## Requirements
      - Match existing component patterns
      - Handle loading, empty, and error states

      ## Constraints
      - Keep the change scoped to what was requested; do not add unrelated refactors.
      - Preserve existing behavior unless the objective explicitly asks for a change.
      - Flag any assumptions made due to missing information.

      ## Best Practices to Apply
      - Use semantic HTML and ARIA where relevant
      - Avoid unnecessary re-renders

      ## Output Format
      - Summarize the approach briefly before making changes.
      - Make the changes.
      - Summarize what changed and why, and note any follow-up work.

      ## Notes for Claude Code
      Use clear markdown structure with explicit headers; state constraints up front; ask for a brief plan before large edits.
      "
    `);
  });

  it('trims the task description rather than pasting its padding into the objective', () => {
    const prompt = generatePrompt({
      rawInput: '\n\n  Fix the login redirect  \n\n',
      promptType: 'Bug Fix',
      targetAI: 'Claude Code',
    });
    expect(prompt).toContain('## Objective\nFix the login redirect\n');
  });

  it('leaves a visible placeholder when the description is empty', () => {
    // An empty Objective heading would read as a finished prompt with nothing asked.
    const prompt = generatePrompt({
      rawInput: '   ',
      promptType: 'Custom',
      targetAI: 'Claude Code',
    });
    expect(prompt).toContain('(describe the task here)');
  });

  it('inserts the description verbatim, markdown and all', () => {
    const rawInput = '## Not a real heading\n- item\n`code`\n${notATemplate}';
    const prompt = generatePrompt({ rawInput, promptType: 'Custom', targetAI: 'Claude Code' });
    expect(prompt).toContain(rawInput);
  });

  it('renders for every prompt type with no empty bullet lists', () => {
    for (const promptType of PROMPT_TYPES) {
      const prompt = generatePrompt({
        rawInput: 'do the thing',
        promptType,
        targetAI: 'Claude Code',
      });
      expect(prompt, promptType).toContain(
        `Act as a ${PROMPT_TYPE_PROFILES[promptType].roleLabel}.`,
      );
      // A heading followed straight by the next heading means a profile list was empty.
      expect(prompt, promptType).not.toMatch(/##[^\n]*\n\n##/);
      expect(prompt, promptType).not.toContain('- \n');
    }
  });

  it('renders for every target AI and ends with that AI note', () => {
    for (const targetAI of TARGET_AIS) {
      const prompt = generatePrompt({ rawInput: 'do the thing', promptType: 'Custom', targetAI });
      expect(prompt, targetAI).toContain(`## Notes for ${targetAI}\n${targetAINote(targetAI)}`);
    }
  });

  it('falls back to the generic note for an unknown target AI', () => {
    const prompt = generatePrompt({
      rawInput: 'do the thing',
      promptType: 'Custom',
      targetAI: 'Some Future Agent',
    });
    expect(prompt).toContain('## Notes for Some Future Agent');
    expect(prompt).toContain(targetAINote('Some Future Agent'));
  });

  it('is deterministic, so the same input never produces a different prompt', () => {
    const input = {
      rawInput: 'do the thing',
      promptType: 'Backend' as PromptType,
      targetAI: 'Claude Code',
    };
    expect(generatePrompt(input)).toBe(generatePrompt(input));
  });
});

describe('buildPromptGenerationRequest', () => {
  it('passes the category and the target AI as guidance, and the task in a fenced block', () => {
    const request = buildPromptGenerationRequest({
      rawInput: 'Add a dark mode toggle',
      promptType: 'Frontend',
      targetAI: 'Claude Code',
    });
    expect(request).toContain('paste directly into Claude Code');
    expect(request).toContain('Task category: Frontend');
    expect(request).toContain('commissioning a senior frontend engineer');
    expect(request).toContain('"""\nAdd a dark mode toggle\n"""');
    expect(request).toContain(targetAINote('Claude Code'));
    // The AI writes the prompt, so anything around the answer would end up pasted too.
    expect(request).toContain('Output ONLY the prompt text itself');
  });

  it('flattens the profile lists into the guidance line', () => {
    const profile = PROMPT_TYPE_PROFILES.Backend;
    const request = buildPromptGenerationRequest({
      rawInput: 'do the thing',
      promptType: 'Backend',
      targetAI: 'Claude Code',
    });
    expect(request).toContain(`Focus areas: ${profile.focusAreas.join(', ')}.`);
    expect(request).toContain(`Requirements to satisfy: ${profile.requirements.join(', ')}.`);
    expect(request).toContain(`Best practices to apply: ${profile.bestPractices.join(', ')}.`);
  });

  it('trims the task description and keeps an empty one as an empty block', () => {
    const request = buildPromptGenerationRequest({
      rawInput: '  \n ',
      promptType: 'Custom',
      targetAI: 'Claude Code',
    });
    expect(request).toContain('"""\n\n"""');
  });

  it('builds for every prompt type and target AI without losing a placeholder', () => {
    for (const promptType of PROMPT_TYPES) {
      for (const targetAI of [TARGET_AIS[0], 'Some Future Agent']) {
        const request = buildPromptGenerationRequest({
          rawInput: 'do the thing',
          promptType,
          targetAI,
        });
        expect(request, `${promptType}/${targetAI}`).not.toContain('undefined');
        expect(request, `${promptType}/${targetAI}`).toContain(targetAI);
      }
    }
  });
});
