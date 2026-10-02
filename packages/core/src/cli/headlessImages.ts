import type { CliDefinition } from './registry.js';

export interface HeadlessImageInput {
  /** Added after the rest of the headless args. */
  args: string[];
  /** Goes in front of the prompt text. */
  promptPrefix: string;
  /** Merged into the CLI's environment. */
  env: Record<string, string>;
}

/** True when a headless run of this CLI can be shown a screenshot. */
export function supportsPromptImages(cli: CliDefinition): boolean {
  return !!cli.promptCommand && !!cli.promptImageInput;
}

function mention(cli: CliDefinition, path: string): string {
  const slashed = path.replace(/\\/g, '/');
  const quoted = /\s/.test(slashed) ? `"${slashed}"` : slashed;
  return (cli.fileMention ?? 'at') === 'at' ? `@${quoted}` : quoted;
}

/**
 * What a headless run needs to attach `imagePaths` (relative to its cwd), in the way this CLI
 * takes images. Empty for no images or a CLI that can't take them, so a caller can always apply it.
 */
export function buildHeadlessImageInput(
  cli: CliDefinition,
  imagePaths: string[],
): HeadlessImageInput {
  if (imagePaths.length === 0 || !supportsPromptImages(cli)) {
    return { args: [], promptPrefix: '', env: {} };
  }
  const env = { ...cli.promptImageEnv };
  const extra = cli.promptImageArgs ?? [];
  switch (cli.promptImageInput) {
    case 'flag': {
      const flag = cli.promptImageFlag;
      return {
        args: [...extra, ...imagePaths.flatMap((path) => (flag ? [flag, path] : [path]))],
        promptPrefix: '',
        env,
      };
    }
    case 'mention':
      return {
        args: [...extra],
        promptPrefix: `${imagePaths.map((path) => mention(cli, path)).join(' ')} `,
        env,
      };
    default: {
      const files = imagePaths.map((path) => `./${path.replace(/\\/g, '/')}`).join(', ');
      return {
        args: [...extra],
        promptPrefix:
          `Before anything else, use the Read tool to look at ${files}. ` +
          'Do not read or do anything else with your tools.\n\n',
        env,
      };
    }
  }
}
