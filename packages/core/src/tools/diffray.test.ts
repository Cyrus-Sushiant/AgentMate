import { describe, expect, it } from 'vitest';
import type { AgentType } from '../types/index.js';
import {
  allDiffrayAgentIds,
  allDiffraySeverities,
  buildDiffrayCodebaseScript,
  buildDiffrayProjectConfig,
  buildDiffrayReviewCommand,
  chunkDiffrayFiles,
  DIFFRAY_AGENTS,
  DIFFRAY_DEFAULT_FILES_PER_PASS,
  DIFFRAY_DEFAULT_JSON_FILE,
  DIFFRAY_EXECUTORS,
  DIFFRAY_FILE_PATTERNS,
  DIFFRAY_MAX_FILES_PER_PASS,
  DIFFRAY_MODEL_TRADEOFFS,
  DIFFRAY_MODELS,
  DIFFRAY_PROJECT_CONFIG_FILE,
  DIFFRAY_SEVERITIES,
  type DiffrayReviewInput,
  defaultDiffrayExecutorForAgentType,
  diffrayCodebaseFolders,
  diffrayJsonFileForPass,
  diffrayReviewFlags,
  filterDiffrayCodebaseFiles,
  isDiffrayExecutorId,
  isDiffraySourceFile,
  isDiffrayTestFile,
  joinDiffrayCommands,
  planDiffrayReview,
  redirectDiffrayCommandToFile,
} from './diffray.js';
import type { ToolSettingsValues } from './types.js';

/**
 * npm installs diffray as a .cmd shim on Windows, so every command goes through
 * cmd.exe and its 8191 character line limit: "The command line is too long" is the
 * failure these batching rules exist to prevent. The tests below pin the batching,
 * the flag construction, and the fact that a whole-codebase review never pastes its
 * file list onto a command line at all.
 */

/** The longest single command diffray is allowed to hand a Windows shell. */
const SHELL_LIMIT = 6000;

function review(overrides: Partial<DiffrayReviewInput> = {}): DiffrayReviewInput {
  return {
    scope: 'working-tree',
    agentIds: allDiffrayAgentIds(),
    executor: 'claude-cli',
    severities: allDiffraySeverities(),
    skipValidation: false,
    stream: false,
    ...overrides,
  };
}

describe('catalog invariants', () => {
  it('gives every agent and executor a unique id, a label and a description', () => {
    for (const list of [DIFFRAY_AGENTS, DIFFRAY_EXECUTORS]) {
      const ids = list.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const entry of list) {
        expect(entry.id, entry.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(entry.label.trim(), entry.id).not.toBe('');
        expect(entry.description.trim(), entry.id).not.toBe('');
      }
    }
  });

  it('offers a model list per executor, starting with the executor default', () => {
    for (const executor of DIFFRAY_EXECUTORS) {
      const options = DIFFRAY_MODELS[executor.id];
      expect(options?.length, executor.id).toBeGreaterThan(0);
      // The empty value means "leave the model unset", so no --model flag is added.
      expect(options[0].value, executor.id).toBe('');
      const values = options.map((option) => option.value);
      expect(new Set(values).size, executor.id).toBe(values.length);
      for (const option of options.slice(1)) {
        expect(option.value.trim(), executor.id).not.toBe('');
        expect(option.value, executor.id).not.toMatch(/\s/);
      }
    }
  });

  it('keeps the docs trade-off table consistent', () => {
    const models = DIFFRAY_MODEL_TRADEOFFS.map((row) => row.model);
    expect(new Set(models).size).toBe(models.length);
    for (const row of DIFFRAY_MODEL_TRADEOFFS) {
      expect(row.model.trim(), row.model).not.toBe('');
      expect(row.bestFor.trim(), row.model).not.toBe('');
      expect([1, 2, 3], row.model).toContain(row.cost);
    }
    // At most one row can be the documented sweet spot.
    expect(DIFFRAY_MODEL_TRADEOFFS.filter((row) => row.recommended).length).toBeLessThanOrEqual(1);
  });

  it('hands out copies of the id lists rather than the arrays behind them', () => {
    const ids = allDiffrayAgentIds();
    ids.push('mutated');
    expect(allDiffrayAgentIds()).not.toContain('mutated');
    expect(allDiffraySeverities()).toEqual([...DIFFRAY_SEVERITIES]);
  });
});

describe('isDiffrayExecutorId and defaultDiffrayExecutorForAgentType', () => {
  it('accepts exactly the listed executors', () => {
    for (const executor of DIFFRAY_EXECUTORS) {
      expect(isDiffrayExecutorId(executor.id), executor.id).toBe(true);
    }
    expect(isDiffrayExecutorId('no-such-executor')).toBe(false);
    expect(isDiffrayExecutorId('')).toBe(false);
  });

  it('picks the executor that matches the project agent, and Claude for the rest', () => {
    const expected: Record<AgentType, string> = {
      cursor: 'cursor-agent-cli',
      opencode: 'opencode-cli',
      codex: 'codex-cli',
      'claude-code': 'claude-cli',
      gemini: 'claude-cli',
      generic: 'claude-cli',
    };
    for (const [agentType, executor] of Object.entries(expected)) {
      expect(defaultDiffrayExecutorForAgentType(agentType as AgentType), agentType).toBe(executor);
    }
  });

  it('only ever picks an executor that exists', () => {
    for (const agentType of ['claude-code', 'gemini', 'opencode', 'codex', 'cursor', 'generic']) {
      expect(isDiffrayExecutorId(defaultDiffrayExecutorForAgentType(agentType as AgentType))).toBe(
        true,
      );
    }
  });
});

describe('isDiffraySourceFile', () => {
  it('accepts files with an extension diffray can reason about', () => {
    for (const path of ['src/app.ts', 'src/app.tsx', 'main.py', 'lib/util.go', 'a/b/c.rs']) {
      expect(isDiffraySourceFile(path), path).toBe(true);
    }
  });

  it('accepts a Windows path by normalizing the separators first', () => {
    expect(isDiffraySourceFile(String.raw`src\main\app.ts`)).toBe(true);
    expect(isDiffraySourceFile(String.raw`.\src\app.ts`)).toBe(true);
  });

  it('rejects data, lock and binary files that burn context without findings', () => {
    for (const path of ['package-lock.json', 'logo.png', 'notes.txt', 'data.csv']) {
      expect(isDiffraySourceFile(path), path).toBe(false);
    }
  });

  it('rejects anything inside an ignored directory', () => {
    expect(isDiffraySourceFile('node_modules/pkg/index.js')).toBe(false);
    expect(isDiffraySourceFile('dist/bundle.js')).toBe(false);
  });

  it('rejects generated and bundled output that reads like source', () => {
    for (const path of ['types/index.d.ts', 'app.min.js', 'app.bundle.js', 'api.generated.ts']) {
      expect(isDiffraySourceFile(path), path).toBe(false);
    }
  });

  it('rejects a dotfile, an extensionless file, an empty path and one that climbs out', () => {
    expect(isDiffraySourceFile('.gitignore')).toBe(false);
    expect(isDiffraySourceFile('Makefile')).toBe(false);
    expect(isDiffraySourceFile('')).toBe(false);
    expect(isDiffraySourceFile('../outside/app.ts')).toBe(false);
  });

  it('matches the extension case-insensitively', () => {
    expect(isDiffraySourceFile('src/App.TS')).toBe(true);
  });
});

describe('isDiffrayTestFile', () => {
  it('spots a test by its suffix or by the directory it sits in', () => {
    for (const path of [
      'src/app.test.ts',
      'src/app.spec.tsx',
      'tests/app.ts',
      'src/__tests__/app.ts',
      'e2e/login.ts',
      'src/__mocks__/fs.ts',
    ]) {
      expect(isDiffrayTestFile(path), path).toBe(true);
    }
  });

  it('leaves ordinary source alone, including a file that merely mentions test', () => {
    for (const path of ['src/app.ts', 'src/testing.ts', 'src/latest.ts']) {
      expect(isDiffrayTestFile(path), path).toBe(false);
    }
  });

  it('matches a test directory whatever its casing', () => {
    expect(isDiffrayTestFile('Tests/app.ts')).toBe(true);
  });
});

describe('filterDiffrayCodebaseFiles', () => {
  const paths = [
    'src/app.ts',
    'src/app.test.ts',
    'src/ui/button.tsx',
    'docs/readme.md',
    'node_modules/pkg/index.js',
    String.raw`src\win\path.ts`,
    'src/app.ts',
  ];

  it('keeps source only, drops tests by default, dedupes and sorts', () => {
    expect(filterDiffrayCodebaseFiles(paths)).toEqual([
      'src/app.ts',
      'src/ui/button.tsx',
      'src/win/path.ts',
    ]);
  });

  it('keeps tests when asked', () => {
    expect(filterDiffrayCodebaseFiles(paths, { includeTests: true })).toContain('src/app.test.ts');
  });

  it('narrows to a folder, tolerating slashes on either end and either direction', () => {
    expect(filterDiffrayCodebaseFiles(paths, { folder: 'src/ui' })).toEqual(['src/ui/button.tsx']);
    expect(filterDiffrayCodebaseFiles(paths, { folder: '/src/ui/' })).toEqual([
      'src/ui/button.tsx',
    ]);
    expect(filterDiffrayCodebaseFiles(paths, { folder: String.raw`src\ui` })).toEqual([
      'src/ui/button.tsx',
    ]);
  });

  it('never matches a sibling folder that merely starts with the same letters', () => {
    expect(filterDiffrayCodebaseFiles(['srcx/app.ts', 'src/app.ts'], { folder: 'src' })).toEqual([
      'src/app.ts',
    ]);
  });

  it('is empty when nothing matches', () => {
    expect(filterDiffrayCodebaseFiles([])).toEqual([]);
    expect(filterDiffrayCodebaseFiles(paths, { folder: 'nowhere' })).toEqual([]);
  });
});

describe('diffrayCodebaseFolders', () => {
  it('counts files per folder, two levels deep, sorted by path', () => {
    expect(
      diffrayCodebaseFolders(['src/app.ts', 'src/ui/button.tsx', 'src/ui/card.tsx', 'lib/a.ts']),
    ).toEqual([
      { path: 'lib', fileCount: 1 },
      { path: 'src', fileCount: 3 },
      { path: 'src/ui', fileCount: 2 },
    ]);
  });

  it('honours a deeper maxDepth when one is asked for', () => {
    const folders = diffrayCodebaseFolders(['a/b/c/d.ts'], {}, 3);
    expect(folders.map((folder) => folder.path)).toEqual(['a', 'a/b', 'a/b/c']);
  });

  it('ignores files at the repository root, which are not a folder to pick', () => {
    expect(diffrayCodebaseFolders(['app.ts'])).toEqual([]);
  });
});

describe('chunkDiffrayFiles', () => {
  it('splits at the requested count', () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/f${i}.ts`);
    const batches = chunkDiffrayFiles(files, 10);
    expect(batches.map((batch) => batch.length)).toEqual([10, 10, 5]);
    expect(batches.flat()).toEqual(files);
  });

  it('clamps an out-of-range files-per-pass rather than producing empty or huge passes', () => {
    const files = Array.from({ length: 100 }, (_, i) => `src/f${i}.ts`);
    expect(chunkDiffrayFiles(files, 0).every((batch) => batch.length === 1)).toBe(true);
    expect(chunkDiffrayFiles(files, -5).every((batch) => batch.length === 1)).toBe(true);
    expect(chunkDiffrayFiles(files, 1000)[0].length).toBe(DIFFRAY_MAX_FILES_PER_PASS);
    // A fractional value from a number input is rounded, not truncated to zero.
    expect(chunkDiffrayFiles(files, 4.6)[0].length).toBe(5);
  });

  it('ends a pass early when the paths alone would outgrow the shell line limit', () => {
    // Twenty paths of 400 characters is 8000, past what cmd.exe accepts.
    const files = Array.from({ length: 20 }, (_, i) => `src/${'d'.repeat(390)}/f${i}.ts`);
    const batches = chunkDiffrayFiles(files, DIFFRAY_MAX_FILES_PER_PASS);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(batch.join(',').length).toBeLessThanOrEqual(SHELL_LIMIT);
    }
  });

  it('keeps a single path that is longer than the whole budget, rather than losing it', () => {
    const huge = `src/${'d'.repeat(9000)}.ts`;
    expect(chunkDiffrayFiles([huge])).toEqual([[huge]]);
  });

  it('leaves room for the command around the file list', () => {
    const files = Array.from({ length: 60 }, (_, i) => `src/${'d'.repeat(200)}/f${i}.ts`);
    const withOverhead = chunkDiffrayFiles(files, DIFFRAY_MAX_FILES_PER_PASS, 2000);
    for (const batch of withOverhead) {
      expect(batch.join(',').length + 2000).toBeLessThanOrEqual(SHELL_LIMIT + 200);
    }
  });

  it('is empty for no files and never emits an empty pass', () => {
    expect(chunkDiffrayFiles([])).toEqual([]);
    const batches = chunkDiffrayFiles(
      Array.from({ length: 7 }, (_, i) => `f${i}.ts`),
      3,
    );
    for (const batch of batches) expect(batch.length).toBeGreaterThan(0);
  });

  it('defaults to the documented files per pass', () => {
    const files = Array.from({ length: 30 }, (_, i) => `src/f${i}.ts`);
    expect(chunkDiffrayFiles(files)[0].length).toBe(DIFFRAY_DEFAULT_FILES_PER_PASS);
  });
});

describe('buildDiffrayReviewCommand', () => {
  it('reviews the working tree with no scope flags when everything is default', () => {
    expect(buildDiffrayReviewCommand(review())).toBe('diffray review --executor claude-cli');
  });

  it('passes an explicit base branch through', () => {
    expect(
      buildDiffrayReviewCommand(review({ scope: 'base-branch', baseRef: '  origin/main  ' })),
    ).toContain('--base origin/main');
  });

  it('falls back to the working tree when the base branch field is blank', () => {
    expect(
      buildDiffrayReviewCommand(review({ scope: 'base-branch', baseRef: '  ' })),
    ).not.toContain('--base');
  });

  it('turns a commit count into a HEAD~n base, clamped and rounded', () => {
    expect(buildDiffrayReviewCommand(review({ scope: 'last-commits' }))).toContain('--base HEAD~3');
    expect(buildDiffrayReviewCommand(review({ scope: 'last-commits', commitCount: 7 }))).toContain(
      '--base HEAD~7',
    );
    expect(buildDiffrayReviewCommand(review({ scope: 'last-commits', commitCount: 0 }))).toContain(
      '--base HEAD~1',
    );
    expect(
      buildDiffrayReviewCommand(review({ scope: 'last-commits', commitCount: 500 })),
    ).toContain('--base HEAD~50');
  });

  it('passes a file list as one comma-separated flag, with --full only when asked', () => {
    expect(
      buildDiffrayReviewCommand(review({ scope: 'files', files: ['a.ts', 'b.ts'] })),
    ).toContain('--files a.ts,b.ts');
    expect(
      buildDiffrayReviewCommand(review({ scope: 'files', files: ['a.ts'], fullFiles: true })),
    ).toContain('--files a.ts --full');
  });

  it('always reviews whole files in codebase scope, and never alongside --base', () => {
    const command = buildDiffrayReviewCommand(review({ scope: 'codebase', files: ['a.ts'] }));
    expect(command).toContain('--files a.ts --full');
    // The CLI rejects --full together with --base.
    expect(command).not.toContain('--base');
  });

  it('drops the file flag when the list is empty', () => {
    expect(buildDiffrayReviewCommand(review({ scope: 'files', files: [] }))).not.toContain(
      '--files',
    );
  });

  it('quotes only the arguments that need it, and escapes an embedded quote', () => {
    const command = buildDiffrayReviewCommand(
      review({ scope: 'files', files: ['src/my file.ts'], model: 'test-model' }),
    );
    expect(command).toContain('"src/my file.ts"');
    expect(command).toContain('--model test-model');
    expect(
      buildDiffrayReviewCommand(review({ scope: 'base-branch', baseRef: 'feat/"odd"' })),
    ).toContain(String.raw`"feat/\"odd\""`);
  });
});

describe('diffrayReviewFlags', () => {
  it('omits the agent and severity flags when everything is selected', () => {
    // A shorter command is the point: these are the CLI's own defaults.
    expect(diffrayReviewFlags(review())).toEqual(['--executor', 'claude-cli']);
  });

  it('passes a partial selection as one comma-separated list, never a repeated flag', () => {
    const flags = diffrayReviewFlags(
      review({ agentIds: ['general', 'bug-hunter'], severities: ['critical', 'high'] }),
    );
    expect(flags.join(' ')).toContain('--agent general,bug-hunter');
    expect(flags.join(' ')).toContain('--severity critical,high');
    expect(flags.filter((flag) => flag === '--agent')).toHaveLength(1);
  });

  it('drops agent ids and severities the CLI would not recognise', () => {
    const flags = diffrayReviewFlags(
      review({ agentIds: ['general', 'made-up'], severities: ['high', 'catastrophic'] }),
    );
    expect(flags.join(' ')).toContain('--agent general');
    expect(flags.join(' ')).not.toContain('made-up');
    expect(flags.join(' ')).toContain('--severity high');
    expect(flags.join(' ')).not.toContain('catastrophic');
  });

  it('omits the flag entirely when the filtered selection is empty', () => {
    expect(diffrayReviewFlags(review({ agentIds: ['made-up'], severities: [] })).join(' ')).toBe(
      '--executor claude-cli',
    );
  });

  it('omits the executor and the model when they are blank', () => {
    expect(diffrayReviewFlags(review({ executor: '  ', model: '  ' }))).toEqual([]);
  });

  it('adds the optional switches', () => {
    expect(diffrayReviewFlags(review({ skipValidation: true })).join(' ')).toContain(
      '--skip-validation',
    );
    expect(diffrayReviewFlags(review({ stream: true })).join(' ')).toContain('--stream');
    expect(diffrayReviewFlags(review({ jsonOutput: true })).join(' ')).toContain('--json');
  });

  it('never streams alongside JSON, since the progress lines would land in the report', () => {
    const flags = diffrayReviewFlags(review({ stream: true, jsonOutput: true }));
    expect(flags).toContain('--json');
    expect(flags).not.toContain('--stream');
  });
});

describe('diffrayJsonFileForPass', () => {
  it('leaves a single-pass run with the plain name', () => {
    expect(diffrayJsonFileForPass('report.json', 1, 1)).toBe('report.json');
  });

  it('numbers each pass so a multi-pass run does not overwrite itself', () => {
    expect(diffrayJsonFileForPass('report.json', 1, 3)).toBe('report-1.json');
    expect(diffrayJsonFileForPass('report.json', 3, 3)).toBe('report-3.json');
  });

  it('adds the extension when the user typed a bare name', () => {
    expect(diffrayJsonFileForPass('report', 1, 1)).toBe('report.json');
    expect(diffrayJsonFileForPass('report', 2, 2)).toBe('report-2.json');
  });

  it('falls back to the default name for a blank one', () => {
    expect(diffrayJsonFileForPass('   ', 1, 1)).toBe(DIFFRAY_DEFAULT_JSON_FILE);
  });

  it('matches the extension case-insensitively', () => {
    expect(diffrayJsonFileForPass('Report.JSON', 2, 2)).toBe('Report-2.json');
  });
});

describe('redirectDiffrayCommandToFile', () => {
  it('uses a plain redirect on posix', () => {
    expect(redirectDiffrayCommandToFile('diffray review', 'report.json', 'posix')).toBe(
      'diffray review > report.json',
    );
    expect(redirectDiffrayCommandToFile('diffray review', 'my report.json', 'posix')).toContain(
      '"my report.json"',
    );
  });

  it('writes through .NET on PowerShell, where > and Out-File corrupt the JSON', () => {
    const command = redirectDiffrayCommandToFile('diffray review', 'report.json', 'powershell');
    expect(command).toContain('[IO.File]::WriteAllText');
    // Both `>` (UTF-16) and Out-File (BOM) produce a file a JSON parser rejects.
    expect(command).not.toContain('Out-File');
    expect(command).toContain("Join-Path $PWD 'report.json'");
  });

  it("doubles a single quote in a PowerShell literal, so a name with an apostrophe can't break out", () => {
    expect(redirectDiffrayCommandToFile('x', "o'brien.json", 'powershell')).toContain(
      "'o''brien.json'",
    );
  });
});

describe('planDiffrayReview', () => {
  it('produces a single command for every scope but codebase', () => {
    for (const scope of ['working-tree', 'base-branch', 'last-commits', 'files'] as const) {
      const plan = planDiffrayReview(review({ scope, files: ['a.ts'] }));
      expect(plan.commands.length, scope).toBe(1);
      expect(plan.reportFiles, scope).toEqual([]);
    }
  });

  it('splits a codebase review into passes', () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/f${i}.ts`);
    const plan = planDiffrayReview(review({ scope: 'codebase', files, filesPerPass: 10 }));
    expect(plan.commands).toHaveLength(3);
    for (const command of plan.commands) expect(command).toContain('--full');
  });

  it('keeps every planned command inside the Windows shell line limit', () => {
    // 300 long paths is far past what a single cmd.exe line accepts.
    const files = Array.from({ length: 300 }, (_, i) => `src/${'deep/'.repeat(12)}file-${i}.ts`);
    const plan = planDiffrayReview(
      review({
        scope: 'codebase',
        files,
        filesPerPass: DIFFRAY_MAX_FILES_PER_PASS,
        jsonOutput: true,
      }),
      { shell: 'powershell', jsonFileName: 'report.json' },
    );
    expect(plan.commands.length).toBeGreaterThan(1);
    for (const command of plan.commands) {
      expect(command.length).toBeLessThanOrEqual(8191);
    }
  });

  it('names one report file per pass when JSON output is on', () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/f${i}.ts`);
    const plan = planDiffrayReview(
      review({ scope: 'codebase', files, filesPerPass: 10, jsonOutput: true }),
      { jsonFileName: 'report.json' },
    );
    expect(plan.reportFiles).toEqual(['report-1.json', 'report-2.json', 'report-3.json']);
    expect(plan.commands).toHaveLength(plan.reportFiles.length);
    for (let i = 0; i < plan.commands.length; i += 1) {
      expect(plan.commands[i]).toContain(plan.reportFiles[i]);
    }
  });

  it('uses the default report name when none is given', () => {
    const plan = planDiffrayReview(review({ jsonOutput: true }), { jsonFileName: '  ' });
    expect(plan.reportFiles).toEqual([DIFFRAY_DEFAULT_JSON_FILE]);
  });

  it('plans nothing for a codebase scope with no files, rather than a review of everything', () => {
    const plan = planDiffrayReview(review({ scope: 'codebase', files: [] }));
    expect(plan.commands).toEqual([]);
    expect(plan.reportFiles).toEqual([]);
  });
});

describe('joinDiffrayCommands', () => {
  it('chains passes with a semicolon, which every shell the app opens understands', () => {
    // `&&` would stop the remaining passes after one failed, and is not PowerShell 5.1 syntax.
    expect(joinDiffrayCommands(['a', 'b', 'c'])).toBe('a; b; c');
    expect(joinDiffrayCommands(['only'])).toBe('only');
    expect(joinDiffrayCommands([])).toBe('');
  });
});

describe('DIFFRAY_FILE_PATTERNS', () => {
  it('compile as regexes, since the generated script uses them as -match patterns', () => {
    for (const [name, pattern] of Object.entries(DIFFRAY_FILE_PATTERNS)) {
      expect(() => new RegExp(pattern), name).not.toThrow();
    }
  });

  it('agree with the functions the wizard previewed with', () => {
    const source = new RegExp(DIFFRAY_FILE_PATTERNS.source);
    const ignored = new RegExp(DIFFRAY_FILE_PATTERNS.ignored);
    const test = new RegExp(DIFFRAY_FILE_PATTERNS.test);
    const generated = new RegExp(DIFFRAY_FILE_PATTERNS.generated);
    for (const path of ['src/app.ts', 'lib/util.go']) {
      expect(source.test(path), path).toBe(true);
      expect(ignored.test(path), path).toBe(false);
      expect(generated.test(path), path).toBe(false);
    }
    expect(ignored.test('node_modules/pkg/index.js')).toBe(true);
    expect(test.test('src/app.test.ts')).toBe(true);
    expect(test.test('tests/app.ts')).toBe(true);
    expect(generated.test('types/index.d.ts')).toBe(true);
  });
});

describe('buildDiffrayCodebaseScript', () => {
  it('writes a PowerShell script and a launcher that bypasses the execution policy', () => {
    const script = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), {
      shell: 'powershell',
    });
    expect(script.fileName).toBe('diffray-review.ps1');
    expect(script.commandFor('C:/tmp/diffray-review.ps1')).toContain('-ExecutionPolicy Bypass');
    expect(script.commandFor('C:/tmp/diffray-review.ps1')).toContain('-NoProfile');
  });

  it('writes a bash script run with `bash <file>`, so no executable bit is needed', () => {
    const script = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), { shell: 'posix' });
    expect(script.fileName).toBe('diffray-review.sh');
    expect(script.content.startsWith('#!/usr/bin/env bash')).toBe(true);
    expect(script.commandFor('/tmp/diffray-review.sh')).toBe('bash /tmp/diffray-review.sh');
  });

  it('quotes a script path that contains a space', () => {
    const script = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), { shell: 'posix' });
    expect(script.commandFor('/tmp/my dir/run.sh')).toBe('bash "/tmp/my dir/run.sh"');
  });

  it('keeps the file list out of the command entirely, however many files there are', () => {
    // This is the whole reason the codebase scope writes a script: the paths are
    // resolved at run time, so the command the user runs stays one short line.
    const files = Array.from({ length: 5000 }, (_, i) => `src/${'deep/'.repeat(10)}f${i}.ts`);
    for (const shell of ['powershell', 'posix'] as const) {
      const script = buildDiffrayCodebaseScript(review({ scope: 'codebase', files }), { shell });
      const command = script.commandFor(`/tmp/${script.fileName}`);
      expect(command.length, shell).toBeLessThan(200);
      expect(command, shell).not.toContain('f4999.ts');
      expect(script.content, shell).not.toContain('f4999.ts');
    }
  });

  it('caps the per-pass count inside the script the same way the planner does', () => {
    const script = buildDiffrayCodebaseScript(review({ scope: 'codebase', filesPerPass: 1000 }), {
      shell: 'posix',
    });
    expect(script.content).toContain(`per_pass=${DIFFRAY_MAX_FILES_PER_PASS}`);
    expect(script.samplePassCommand).toContain(`<${DIFFRAY_MAX_FILES_PER_PASS} files>`);
  });

  it('gives two projects different script names through the script id', () => {
    const a = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), { scriptId: 'proj-a' });
    const b = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), { scriptId: 'proj-b' });
    expect(a.fileName).not.toBe(b.fileName);
  });

  it('strips separators and spaces out of the script id, so the name stays one file', () => {
    // Dots survive the filter, but the name is always wrapped in a prefix and a
    // suffix, so it can never come out as a traversal segment on its own.
    for (const scriptId of ['../../etc/pa sswd', String.raw`..\..\win`, 'a b|c&d']) {
      const script = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), { scriptId });
      expect(script.fileName, scriptId).toMatch(/^diffray-review-[a-zA-Z0-9._-]+\.sh$/);
      expect(script.fileName, scriptId).not.toMatch(/[\\/\s|&]/);
    }
  });

  it('escapes a project label so it cannot end the script comment or inject a command', () => {
    for (const shell of ['powershell', 'posix'] as const) {
      const script = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), {
        shell,
        label: "O'Brien's `app`",
      });
      expect(script.content, shell).toContain('diffray whole-file review');
    }
  });

  it("quotes a skip list entry with an apostrophe in each shell's own way", () => {
    const posix = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), {
      shell: 'posix',
      skipFiles: ["src/o'brien.ts"],
    });
    expect(posix.content).toContain(String.raw`'src/o'\''brien.ts'`);
    const powershell = buildDiffrayCodebaseScript(review({ scope: 'codebase' }), {
      shell: 'powershell',
      skipFiles: ["src/o'brien.ts"],
    });
    expect(powershell.content).toContain("'src/o''brien.ts'");
  });

  it('shows a sample pass that carries the same flags the real passes will', () => {
    const input = review({ scope: 'codebase', agentIds: ['general'], skipValidation: true });
    const script = buildDiffrayCodebaseScript(input, { shell: 'posix' });
    for (const flag of diffrayReviewFlags(input)) {
      expect(script.samplePassCommand, flag).toContain(flag);
    }
  });
});

describe('buildDiffrayProjectConfig', () => {
  it('writes a project-relative config file with valid JSON', () => {
    const action = buildDiffrayProjectConfig({ executor: 'codex-cli', excludeTests: false });
    expect(action.kind).toBe('write-project-file');
    if (action.kind !== 'write-project-file') return;
    expect(action.relativePath).toBe(DIFFRAY_PROJECT_CONFIG_FILE);
    expect(action.content.endsWith('\n')).toBe(true);
    expect(JSON.parse(action.content)).toEqual({ executor: 'codex-cli', concurrency: 6 });
  });

  it('falls back to the Claude executor for an unknown or missing value', () => {
    // The union of these object shapes is narrower than the settings record the function takes,
    // so they are typed as that record up front.
    const cases: ToolSettingsValues[] = [{}, { executor: 'made-up' }, { executor: '' }];
    for (const values of cases) {
      const action = buildDiffrayProjectConfig(values);
      if (action.kind !== 'write-project-file') continue;
      expect(JSON.parse(action.content).executor).toBe('claude-cli');
    }
  });

  it('adds the exclude patterns only when tests are excluded', () => {
    const on = buildDiffrayProjectConfig({ executor: 'claude-cli', excludeTests: true });
    const off = buildDiffrayProjectConfig({ executor: 'claude-cli', excludeTests: false });
    if (on.kind !== 'write-project-file' || off.kind !== 'write-project-file') return;
    expect(JSON.parse(on.content).excludePatterns).toContain('**/*.test.ts');
    expect(JSON.parse(off.content).excludePatterns).toBeUndefined();
  });
});
