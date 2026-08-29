import { targetAINote } from '../promptBuilder/targetAiNotes.js';
import type { BlueprintStepId } from '../types/index.js';
import { flattenAttachmentRefs } from './attachments.js';
import { blueprintStep } from './steps.js';

export interface BlueprintPromptSection {
  stepId: BlueprintStepId;
  /** English text for this step. Empty sections are dropped before they reach here. */
  text: string;
  /** Display names of the files attached to this step. */
  attachmentNames: string[];
}

export interface BlueprintPromptInput {
  projectName: string;
  /** Human label for the project's agent, e.g. "Claude Code". */
  agentLabel: string;
  targetAI: string;
  /** Project-relative folder the plan is written into. Already normalized. */
  docsFolder: string;
  sections: BlueprintPromptSection[];
  /** Ask the agent to list its intended phases and epics before writing anything. */
  confirmBeforeWriting: boolean;
}

function filled(sections: BlueprintPromptSection[]): BlueprintPromptSection[] {
  return sections.filter((section) => section.text.trim().length > 0);
}

function sectionBlocks(sections: BlueprintPromptSection[]): string {
  return filled(sections)
    .map(
      (section) =>
        // The app's own file URLs mean nothing wherever this prompt is read, so
        // each reference becomes a mention of the file by name instead.
        `## ${blueprintStep(section.stepId).heading}\n\n${flattenAttachmentRefs(section.text).trim()}`,
    )
    .join('\n\n');
}

function attachmentNames(sections: BlueprintPromptSection[]): string[] {
  return [...new Set(sections.flatMap((section) => section.attachmentNames))].filter(Boolean);
}

function referenceBlock(sections: BlueprintPromptSection[]): string {
  const names = attachmentNames(sections);
  if (names.length === 0) return 'None.';
  return [
    ...names.map((name) => `- ${name}`),
    '',
    'These were attached to the blueprint and may not be present in the repository. Ask for any',
    'you need rather than guessing at their contents.',
  ].join('\n');
}

const ARTIFACTS = (
  docsFolder: string,
): string => `1. \`${docsFolder}/PRODUCT_BRIEF.md\`: the problem, who has it, the value it delivers, how success
   is measured, and an explicit "Out of scope" list.
2. \`${docsFolder}/ROADMAP.md\`: the delivery phases in order. Each phase gets a name, a goal stated
   as an outcome rather than an activity, entry and exit criteria, and links to its epics.
3. \`${docsFolder}/epics/NN-slug.md\`: one file per epic, numbered in delivery order, each with its
   objective, the user-visible outcome, acceptance criteria, dependencies, and the risks it carries.
4. \`${docsFolder}/BACKLOG.md\`: every epic broken into implementation-sized tasks, each with a
   stable id (E<epic>-T<task>), a one-line description, acceptance criteria, and its dependencies.
5. \`${docsFolder}/MILESTONES.md\`: the order the phases ship in and what can be demonstrated at each one.
6. \`${docsFolder}/RISKS.md\`: technical and delivery risks, each with impact, likelihood, and a
   concrete mitigation.`;

const RULES = `- Ground every artifact in the blueprint above. Where the blueprint is silent, write the
  assumption down under an "## Assumptions" heading instead of quietly inventing a requirement.
- Use the technologies the blueprint names. Do not substitute them or modernize them.
- Size tasks so each one is a single focused change. Split anything that would take more than
  about a day.
- Order the phases so every phase ends with something that can be run and demonstrated.
- Cross-link the files: the roadmap links to the epics, and each epic links to its backlog tasks.
- Write in English, in Markdown. No "TBD", no placeholder sections.`;

/**
 * Assembles the Product Manager prompt locally. This is what seeds the editor
 * before any AI call, and the result the user keeps when no provider is
 * configured: translation needs no key, but generation does, and the wizard
 * shouldn't be dead for someone who never set one up.
 */
export function buildBlueprintPrompt(input: BlueprintPromptInput): string {
  const { projectName, agentLabel, docsFolder, sections, confirmBeforeWriting } = input;
  const confirm = confirmBeforeWriting
    ? `

# Before you start

List the phases and epics you intend to create, then wait for confirmation before writing any files.`
    : '';

  return `# Role

You are an experienced Product Manager and delivery lead. You have just been handed the project
blueprint below. Your job is to turn it into an executable plan that an engineering team, human
or AI, can start working from tomorrow.

# Project

Name: ${projectName}
Primary coding agent: ${agentLabel}

${sectionBlocks(sections) || '_(the blueprint is empty; ask for it before planning)_'}

## Reference material provided by the author

${referenceBlock(sections)}

# What to produce

Work only inside \`${docsFolder}/\`. Create the folder if it does not exist. Do not modify
application source, configuration, or dependencies as part of this task.

Write these files:

${ARTIFACTS(docsFolder)}

# Rules

${RULES}${confirm}
`;
}

/**
 * The request sent to the user's provider so *it* writes the final prompt, the
 * same division of labour `buildPromptGenerationRequest` uses: only the English
 * blueprint goes in verbatim, everything else is guidance.
 */
export function buildBlueprintGenerationRequest(input: BlueprintPromptInput): string {
  const { projectName, agentLabel, targetAI, docsFolder, sections, confirmBeforeWriting } = input;
  const names = attachmentNames(sections);

  return `You are an expert prompt engineer. Write a single, complete, ready-to-use prompt that a developer can paste directly into ${targetAI} to have it act as the Product Manager for the project described below.

The prompt you write must instruct the assistant to:
- take the role of an experienced Product Manager and delivery lead, not to write application code;
- produce delivery phases, epics, an implementation-sized task backlog, milestones, and a risk register;
- write every artifact as Markdown files inside the project's \`${docsFolder}/\` folder, creating it if needed, and to change nothing else in the repository;
- ground everything in the blueprint and record assumptions explicitly wherever the blueprint is silent;
- keep the technology choices exactly as the blueprint states them;
- cross-link the artifacts so the roadmap, the epics, and the backlog reference each other;${
    confirmBeforeWriting
      ? '\n- list the phases and epics it intends to create and wait for confirmation before writing any files;'
      : ''
  }
- write in English, in Markdown, with no "TBD" and no placeholder sections.

Suggested artifacts to name in the prompt:

${ARTIFACTS(docsFolder)}

Project name: ${projectName}
Primary coding agent: ${agentLabel}
Docs folder: ${docsFolder}
Reference material the author attached: ${names.length > 0 ? names.join(', ') : 'none'}.

Notes specific to ${targetAI}: ${targetAINote(targetAI)}

Project blueprint:
"""
${sectionBlocks(sections)}
"""

Write the final prompt now, in clear English, structured for ${targetAI}. Base it only on the blueprint above; do not invent unrelated requirements. Output ONLY the prompt text itself, with no preamble, explanation, or surrounding commentary.`;
}
