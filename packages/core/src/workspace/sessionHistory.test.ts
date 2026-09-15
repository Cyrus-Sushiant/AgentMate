import { describe, expect, it } from 'vitest';
import {
  claudeProjectDirName,
  codexRolloutMeta,
  promptPreview,
  sameFolder,
  summarizeClaudeTranscript,
  summarizeCodexRollout,
} from './sessionHistory.js';

const line = (value: unknown): string => JSON.stringify(value);

describe('claude project folder names', () => {
  it('turns every non alphanumeric character into a dash', () => {
    expect(claudeProjectDirName('E:\\AgentMate')).toBe('E--AgentMate');
    expect(claudeProjectDirName('/home/me/my_app.v2/')).toBe('-home-me-my-app-v2');
  });

  it('compares folders loosely', () => {
    expect(sameFolder('e:\\AgentMate\\', 'E:/agentmate', true)).toBe(true);
    expect(sameFolder('/a/B', '/a/b', false)).toBe(false);
  });
});

describe('prompt previews', () => {
  it('drops wrappers that the user did not type', () => {
    expect(promptPreview('<command-name>/clear</command-name>')).toBeNull();
    expect(promptPreview('[Request interrupted by user]')).toBeNull();
    expect(promptPreview('   ')).toBeNull();
  });

  it('cleans reminders, images and whitespace', () => {
    expect(
      promptPreview('[Image #1] fix\n\nthe <system-reminder>ignore</system-reminder> header'),
    ).toBe('fix the header');
  });

  it('shortens long prompts', () => {
    const preview = promptPreview('x'.repeat(500)) ?? '';
    expect(preview.length).toBe(240);
    expect(preview.endsWith('…')).toBe(true);
  });
});

describe('claude transcripts', () => {
  const head = [
    line({ type: 'last-prompt', sessionId: 's' }),
    line({
      type: 'user',
      cwd: 'E:\\App',
      gitBranch: 'main',
      entrypoint: 'cli',
      timestamp: '2026-09-01T10:00:00.000Z',
      message: { role: 'user', content: '<command-name>/model</command-name>' },
    }),
    line({
      type: 'user',
      cwd: 'E:\\App',
      timestamp: '2026-09-01T10:00:05.000Z',
      message: { role: 'user', content: [{ type: 'text', text: 'Add a dark mode' }] },
    }),
    line({
      type: 'assistant',
      effort: 'high',
      perTurnEffort: null,
      message: { model: 'claude-opus-5' },
    }),
    line({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } }),
    '{"type":"user","message":{"content":"cut off mid',
  ];

  it('reads the prompt, folder, branch and model', () => {
    const summary = summarizeClaudeTranscript('s', head, []);
    expect(summary).toMatchObject({
      id: 's',
      title: null,
      firstPrompt: 'Add a dark mode',
      lastPrompt: null,
      cwd: 'E:\\App',
      gitBranch: 'main',
      model: 'claude-opus-5',
      effort: 'high',
      startedAt: Date.parse('2026-09-01T10:00:00.000Z'),
      background: false,
    });
  });

  it('prefers a custom title, then the generated one, and takes the latest model', () => {
    const tail = [
      'partial line"}',
      line({ type: 'ai-title', aiTitle: 'Dark mode' }),
      line({
        type: 'assistant',
        gitBranch: 'feat/dark',
        effort: 'xhigh',
        message: { model: 'claude-sonnet-5' },
      }),
      line({ type: 'last-prompt', lastPrompt: 'Now ship it' }),
    ];
    const summary = summarizeClaudeTranscript('s', head, tail);
    expect(summary?.title).toBe('Dark mode');
    expect(summary?.model).toBe('claude-sonnet-5');
    expect(summary?.effort).toBe('xhigh');
    expect(summary?.gitBranch).toBe('feat/dark');
    expect(summary?.lastPrompt).toBe('Now ship it');

    const renamed = summarizeClaudeTranscript('s', head, [
      ...tail,
      line({ type: 'custom-title', customTitle: 'Theme work' }),
    ]);
    expect(renamed?.title).toBe('Theme work');
  });

  it('marks headless runs and skips empty files', () => {
    const headless = summarizeClaudeTranscript(
      's',
      [line({ type: 'user', entrypoint: 'sdk-cli', message: { content: 'Pick a tag' } })],
      [],
    );
    expect(headless?.background).toBe(true);
    expect(
      summarizeClaudeTranscript('s', [line({ type: 'file-history-snapshot' })], []),
    ).toBeNull();
  });
});

describe('codex rollouts', () => {
  const meta = line({
    type: 'session_meta',
    timestamp: '2026-08-17T22:14:26.647Z',
    payload: {
      id: 'abc',
      timestamp: '2026-08-17T22:14:26.483Z',
      cwd: 'E:\\App',
      originator: 'codex_cli_rs',
      git: { branch: 'main' },
    },
  });

  it('reads the meta line', () => {
    expect(codexRolloutMeta(meta)).toEqual({ id: 'abc', cwd: 'E:\\App', background: false });
    expect(codexRolloutMeta(line({ type: 'event_msg' }))).toBeNull();
  });

  it('summarizes prompts and model', () => {
    const summary = summarizeCodexRollout(
      [
        meta,
        line({ type: 'turn_context', payload: { model: 'gpt-5.5', effort: 'medium' } }),
        line({ type: 'event_msg', payload: { type: 'user_message', message: 'Fix the tests' } }),
      ],
      [line({ type: 'event_msg', payload: { type: 'user_message', message: 'And lint' } })],
    );
    expect(summary).toMatchObject({
      id: 'abc',
      firstPrompt: 'Fix the tests',
      lastPrompt: 'And lint',
      model: 'gpt-5.5',
      effort: 'medium',
      gitBranch: 'main',
      startedAt: Date.parse('2026-08-17T22:14:26.483Z'),
    });
  });

  it('flags exec runs', () => {
    const exec = line({ type: 'session_meta', payload: { id: 'x', originator: 'codex_exec' } });
    expect(codexRolloutMeta(exec)?.background).toBe(true);
  });
});
