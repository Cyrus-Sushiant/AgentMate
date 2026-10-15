import { describe, expect, it } from 'vitest';
import { validateRunProposal } from './validate';

const existing = [{ command: 'npm run dev' }];

describe('validateRunProposal', () => {
  it('accepts one line, trimming the label and the command', () => {
    expect(
      validateRunProposal(
        { label: ' android dev ', command: ' flutter run -d emulator-5554 ' },
        existing,
      ),
    ).toEqual({ ok: true, label: 'android dev', command: 'flutter run -d emulator-5554' });
  });

  it('accepts a command without a label, which then has no name', () => {
    expect(validateRunProposal({ command: 'pnpm dev' }, [])).toEqual({
      ok: true,
      label: '',
      command: 'pnpm dev',
    });
  });

  it('refuses an empty command, or one that is not text', () => {
    expect(validateRunProposal({ label: 'x', command: '   ' }, [])).toEqual({
      ok: false,
      error: 'The command is empty.',
    });
    expect(validateRunProposal({ command: 42 }, [])).toEqual({
      ok: false,
      error: 'The command is empty.',
    });
  });

  it('refuses a command that spans lines or holds control characters', () => {
    for (const command of [
      'pnpm dev\nrm -rf x',
      'pnpm dev\rx',
      'pnpm\tdev',
      'pnpm \u001B[31mdev',
    ]) {
      expect(validateRunProposal({ command }, [])).toEqual({
        ok: false,
        error: 'The command must be one line of text.',
      });
    }
  });

  it('refuses a label that spans lines', () => {
    expect(validateRunProposal({ label: 'a\nb', command: 'pnpm dev' }, [])).toEqual({
      ok: false,
      error: 'The label must be one line of text.',
    });
  });

  it('refuses a command longer than 1000 characters, and a label longer than 60', () => {
    expect(validateRunProposal({ command: 'x'.repeat(1001) }, [])).toEqual({
      ok: false,
      error: 'The command is longer than 1000 characters.',
    });
    expect(validateRunProposal({ label: 'x'.repeat(61), command: 'pnpm dev' }, [])).toEqual({
      ok: false,
      error: 'The label is longer than 60 characters.',
    });
  });

  it('refuses a command the project already has, whatever the spacing', () => {
    expect(validateRunProposal({ label: 'again', command: '  npm run dev ' }, existing)).toEqual({
      ok: false,
      error: 'This project already has that run command.',
    });
  });
});
