import { getCliDefinition } from './registry.js';

export interface MentionEntry {
  /** Path relative to the project root, with either separator. */
  relativePath: string;
  isDirectory: boolean;
}

/**
 * Turns files and folders into the text a CLI's input box understands as references to them,
 * e.g. `@src/app.ts @src/lib/ ` for Claude Code. Paths use forward slashes on every OS, folders
 * end in a slash, and a path with whitespace is quoted so the CLI reads it as one. The text ends
 * in a space so the user can type the question straight after it.
 */
export function formatFileMentions(cliId: string, entries: MentionEntry[]): string {
  const style = getCliDefinition(cliId)?.fileMention ?? 'at';
  const mentions = entries.map(({ relativePath, isDirectory }) => {
    const trimmed = relativePath.replace(/\\/g, '/').replace(/\/+$/, '');
    const path = isDirectory ? `${trimmed || '.'}/` : trimmed;
    const quoted = /\s/.test(path) ? `"${path}"` : path;
    return style === 'at' ? `@${quoted}` : quoted;
  });
  return mentions.length > 0 ? `${mentions.join(' ')} ` : '';
}
