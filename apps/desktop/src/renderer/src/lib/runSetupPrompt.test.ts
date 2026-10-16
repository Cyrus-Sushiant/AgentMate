import { describe, expect, it } from 'vitest';
import { buildRunSetupPrompt, DEFAULT_RUN_SETUP_REQUEST, runSetupExamples } from './runSetupPrompt';

const base = {
  request: 'Run the mobile app on the emulator',
  projectName: 'BitIron',
  folderPath: 'E:\\BitIron\\BitIronPlatform',
  platform: 'win32',
};

describe('buildRunSetupPrompt', () => {
  it('carries the request, the project and its folder', () => {
    const prompt = buildRunSetupPrompt(base);

    expect(prompt).toContain('Run the mobile app on the emulator');
    expect(prompt).toContain('"BitIron"');
    expect(prompt).toContain('E:\\BitIron\\BitIronPlatform');
  });

  it('names the tool the agent must use, and says nothing is saved or run before approval', () => {
    const prompt = buildRunSetupPrompt(base);

    expect(prompt).toContain('propose_run_command');
    expect(prompt).toContain('list_run_commands');
    expect(prompt).toMatch(/approve/i);
    expect(prompt).toMatch(/do not run/i);
  });

  it('tells the agent to read the project before guessing, with Flutter as the example', () => {
    const prompt = buildRunSetupPrompt(base);

    expect(prompt).toContain('pubspec.yaml');
    expect(prompt).toContain('flutter devices');
  });

  it('describes Windows PowerShell on Windows, where && does not chain', () => {
    const prompt = buildRunSetupPrompt(base);

    expect(prompt).toContain('PowerShell');
    expect(prompt).toContain('Push-Location');
    expect(prompt).toContain('.\\');
    expect(prompt).not.toContain('POSIX');
  });

  it('describes a POSIX shell elsewhere, and suggests a shell script', () => {
    const prompt = buildRunSetupPrompt({ ...base, platform: 'darwin' });

    expect(prompt).toContain('POSIX');
    expect(prompt).not.toContain('PowerShell');
    expect(prompt).toContain('./');
  });

  it('trims the request, and falls back to a general one when it is empty', () => {
    expect(buildRunSetupPrompt({ ...base, request: '  start it  ' })).toContain('start it');
    expect(buildRunSetupPrompt({ ...base, request: '   ' })).toContain(
      'Work out how to run this project',
    );
  });

  it('keeps a very long request from swamping the instructions', () => {
    const prompt = buildRunSetupPrompt({ ...base, request: 'x'.repeat(10_000) });

    expect(prompt.length).toBeLessThan(6_000);
  });

  it('uses no em dash', () => {
    expect(buildRunSetupPrompt(base)).not.toContain(String.fromCharCode(0x2014));
    expect(buildRunSetupPrompt({ ...base, platform: 'linux' })).not.toContain(
      String.fromCharCode(0x2014),
    );
  });
});

describe('runSetupExamples', () => {
  it('offers a few requests a person can start from', () => {
    const examples = runSetupExamples('win32');

    expect(examples.length).toBeGreaterThanOrEqual(3);
    expect(examples).toContain('Run the mobile app on the Android emulator');
  });

  it('suggests a .bat file on Windows and a .sh script elsewhere', () => {
    expect(runSetupExamples('win32').join(' ')).toContain('.bat');
    expect(runSetupExamples('linux').join(' ')).toContain('.sh');
    expect(runSetupExamples('linux').join(' ')).not.toContain('.bat');
  });

  it('keeps the default request, which a fresh dialog starts with, in plain words', () => {
    expect(DEFAULT_RUN_SETUP_REQUEST).toBe(
      'Work out how to run this project and create a run command for it.',
    );
  });
});
