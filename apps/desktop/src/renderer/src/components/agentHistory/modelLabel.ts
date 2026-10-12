import { modelDisplayName } from '@/stores/agentStatusStore';

/** A model id as people read it: "Opus 5.5", or "GPT-5-codex" for the OpenAI ids. */
export function shortModel(model: string): string {
  return /^gpt/i.test(model) ? model.replace(/^gpt/i, 'GPT') : modelDisplayName(model);
}
