import type { TextSearchRequest } from '../../shared/apiTypes';

export const MAX_QUERY_LENGTH = 1000;

/**
 * Flags every ripgrep run from the app shares. `--no-config` keeps a user's own ripgreprc
 * from changing the output format, `--no-require-git` applies .gitignore in a folder that is
 * not a repository, and there is no `--follow`, so a link cannot lead the search out of the
 * project.
 */
export const RG_BASE_ARGS = [
  '--no-config',
  '--hidden',
  '--no-require-git',
  '--glob=!.git/',
  '--glob=!node_modules/',
  '--max-filesize=2M',
] as const;

/** The ripgrep command line for one text search, run from the project folder. */
export function buildTextSearchArgs(request: TextSearchRequest): string[] {
  const { query } = request;
  if (!query) throw new Error('Nothing to search for.');
  if (query.length > MAX_QUERY_LENGTH) throw new Error('That search is too long.');
  if (/[\r\n]/.test(query)) throw new Error('A search has to fit on one line.');
  return [
    '--json',
    ...RG_BASE_ARGS,
    // A file with thousands of hits would crowd out every other file.
    '--max-count=100',
    request.matchCase ? '--case-sensitive' : '--ignore-case',
    ...(request.regex ? [] : ['--fixed-strings']),
    ...(request.wholeWord ? ['--word-regexp'] : []),
    // Attached with `=` so a query that starts with a dash stays a query.
    `--regexp=${query}`,
    // An explicit folder, or ripgrep may decide to read from stdin instead.
    '--',
    '.',
  ];
}
