import { describe, expect, it } from 'vitest';
import { projectRunCommandHint, projectRunCommandTitle } from '../types/index.js';
import {
  fillRunInputs,
  insertRunInput,
  missingRunInputs,
  parseRunInputs,
  runCommandParts,
  runCommandSummary,
  runInputLabel,
  sanitizeRunInputValue,
} from './runInputs.js';

describe('parseRunInputs', () => {
  it('finds nothing in plain text or in single braces', () => {
    expect(parseRunInputs('npm run dev')).toEqual([]);
    expect(parseRunInputs('echo {x} {}')).toEqual([]);
  });

  it('reads a bare placeholder as a required input', () => {
    expect(parseRunInputs('npm run dev -- --port {{port}}')).toEqual([
      { name: 'port', required: true, defaultValue: undefined },
    ]);
  });

  it('takes the default after an equals sign, which may hold more equals signs, spaces and backslashes', () => {
    expect(parseRunInputs('a {{k=b=c}} {{msg=hi there}} {{dir=C:\\dev}}')).toEqual([
      { name: 'k', required: true, defaultValue: 'b=c' },
      { name: 'msg', required: true, defaultValue: 'hi there' },
      { name: 'dir', required: true, defaultValue: 'C:\\dev' },
    ]);
  });

  it('marks a name followed by ? as optional, with or without a default', () => {
    expect(parseRunInputs('{{args?}} {{flags?=--watch}}')).toEqual([
      { name: 'args', required: false, defaultValue: undefined },
      { name: 'flags', required: false, defaultValue: '--watch' },
    ]);
  });

  it('reads an empty default as required, starting empty', () => {
    expect(parseRunInputs('{{a=}}')).toEqual([{ name: 'a', required: true, defaultValue: '' }]);
  });

  it('lists a repeated name once: required if any use is, and the first default given wins', () => {
    expect(parseRunInputs('{{x?}} {{x=1}} {{x?=2}} {{y?}} {{y?=z}}')).toEqual([
      { name: 'x', required: true, defaultValue: '1' },
      { name: 'y', required: false, defaultValue: 'z' },
    ]);
  });

  it('keeps the order of first appearance', () => {
    expect(parseRunInputs('{{b}} {{a}} {{b}}').map((input) => input.name)).toEqual(['b', 'a']);
  });

  it('ignores anything that is not a clean placeholder', () => {
    expect(parseRunInputs('docker ps --format "{{.Names}}"')).toEqual([]);
    expect(parseRunInputs('echo {{ port }}')).toEqual([]);
    expect(parseRunInputs('{{range .Items}}x{{end}}{{else}}{{break}}{{continue}}')).toEqual([]);
    expect(parseRunInputs('{{port=3000}')).toEqual([]);
    expect(parseRunInputs('{{1port}}')).toEqual([]);
  });

  it('keeps a brace inside a default literal, and reads extra braces around a name as literal', () => {
    expect(parseRunInputs('{{body={"a":1}}}')).toEqual([]);
    expect(parseRunInputs('{{{x}}}')).toEqual([
      { name: 'x', required: true, defaultValue: undefined },
    ]);
    expect(parseRunInputs('{{x}}}')).toEqual([
      { name: 'x', required: true, defaultValue: undefined },
    ]);
  });

  it('reads names in any script, with digits, dashes and underscores', () => {
    expect(
      parseRunInputs('{{سلام}} {{target-env}} {{api_key2}}').map((input) => input.name),
    ).toEqual(['سلام', 'target-env', 'api_key2']);
  });

  it('reads a name with a zero width non-joiner, as Persian compounds are written', () => {
    expect(parseRunInputs('{{شماره\u200Cتلفن}}').map((input) => input.name)).toEqual([
      'شماره\u200Cتلفن',
    ]);
  });

  it('accepts names that are also object property names', () => {
    expect(parseRunInputs('{{constructor}} {{__proto__?}}').map((input) => input.name)).toEqual([
      'constructor',
      '__proto__',
    ]);
  });
});

describe('runInputLabel', () => {
  it('turns a name into a sentence-case label', () => {
    expect(runInputLabel('port')).toBe('Port');
    expect(runInputLabel('target-env')).toBe('Target env');
    expect(runInputLabel('api_key')).toBe('Api key');
  });
});

describe('sanitizeRunInputValue', () => {
  it('turns control characters into spaces and trims the edges', () => {
    expect(sanitizeRunInputValue('\t4000\r\n')).toBe('4000');
    expect(sanitizeRunInputValue('a\tb')).toBe('a b');
    expect(sanitizeRunInputValue('\u001B[31m4000\u007F')).toBe('[31m4000');
  });

  it('keeps inner spaces and zero width non-joiners', () => {
    expect(sanitizeRunInputValue('  my app  ')).toBe('my app');
    expect(sanitizeRunInputValue('a\u200Cb')).toBe('a\u200Cb');
  });
});

describe('fillRunInputs', () => {
  it('puts typed values in place, raw, without quoting', () => {
    expect(
      fillRunInputs('serve --port {{port}} --name {{name}}', { port: '4000', name: 'my app' }),
    ).toBe('serve --port 4000 --name my app');
    expect(fillRunInputs('open {{path}}', { path: 'C:\\My Files\\"x"' })).toBe(
      'open C:\\My Files\\"x"',
    );
  });

  it('uses the default until something is typed, and an emptied field stays empty', () => {
    const command = 'npm run dev -- --port {{port=3000}}';

    expect(fillRunInputs(command, {})).toBe('npm run dev -- --port 3000');
    expect(fillRunInputs(command, { port: '4000' })).toBe('npm run dev -- --port 4000');
    expect(fillRunInputs(command, { port: '' })).toBe('npm run dev -- --port {{port=3000}}');
  });

  it('fills every use of a repeated name', () => {
    expect(fillRunInputs('a {{x}} b {{x}}', { x: 'y' })).toBe('a y b y');
  });

  it('drops an empty optional value and trims the result', () => {
    expect(fillRunInputs('npm test -- {{args?}}', { args: '' })).toBe('npm test --');
    expect(fillRunInputs('npm test {{args?}}', {})).toBe('npm test');
  });

  it('inserts values literally, with no pattern expansion and no rescanning of what was typed', () => {
    expect(fillRunInputs('echo {{x}}', { x: '$& $1 {{y}}' })).toBe('echo $& $1 {{y}}');
    expect(fillRunInputs('echo {{x}} {{y}}', { x: '{{y}}', y: 'z' })).toBe('echo {{y}} z');
  });

  it('sanitizes typed control characters before filling', () => {
    expect(fillRunInputs('echo {{x}}', { x: 'a\r\nb' })).toBe('echo a b');
  });
});

describe('missingRunInputs', () => {
  it('lists the required inputs that are blank, in order', () => {
    const inputs = parseRunInputs('{{a}} {{b?}} {{c=1}} {{d}}');

    expect(missingRunInputs(inputs, { a: '  ', c: '' }).map((input) => input.name)).toEqual([
      'a',
      'c',
      'd',
    ]);
  });

  it('does not count a required input with a default until it is emptied', () => {
    const inputs = parseRunInputs('{{p=3000}}');

    expect(missingRunInputs(inputs, {})).toEqual([]);
    expect(missingRunInputs(inputs, { p: '' }).map((input) => input.name)).toEqual(['p']);
  });
});

describe('runCommandParts', () => {
  it('flags typed values, and joins to the filled command', () => {
    const command = 'npm run dev -- --port {{port=3000}} {{args?}}';
    const values = { port: '4000', args: '--open' };
    const parts = runCommandParts(command, values);

    expect(parts).toEqual([
      { kind: 'text', text: 'npm run dev -- --port ' },
      { kind: 'value', name: 'port', text: '4000' },
      { kind: 'text', text: ' ' },
      { kind: 'value', name: 'args', text: '--open' },
    ]);
    expect(
      parts
        .map((part) => part.text)
        .join('')
        .trim(),
    ).toBe(fillRunInputs(command, values));
  });

  it('keeps a missing required token as written, and marks it', () => {
    expect(runCommandParts('serve {{port}}', {})).toEqual([
      { kind: 'text', text: 'serve ' },
      { kind: 'missing', name: 'port', text: '{{port}}' },
    ]);
  });
});

describe('insertRunInput', () => {
  it('appends a placeholder after a space when the command has text', () => {
    expect(insertRunInput('npm run dev', 11, 11)).toEqual({
      command: 'npm run dev {{value}}',
      selectionStart: 14,
      selectionEnd: 19,
    });
  });

  it.each([
    ['', '{{value}}'],
    ['npm run ', 'npm run {{value}}'],
    ['npm --port=', 'npm --port={{value}}'],
    ['http://localhost:', 'http://localhost:{{value}}'],
    ['./', './{{value}}'],
    ['echo (', 'echo ({{value}}'],
    ['echo "', 'echo "{{value}}'],
    ["echo '", "echo '{{value}}"],
    ['cd C:\\', 'cd C:\\{{value}}'],
  ])('appends to %s without a space in front of it', (command, expected) => {
    expect(insertRunInput(command, command.length, command.length).command).toBe(expected);
  });

  it('inserts at the caret, with a space after when a word follows', () => {
    expect(insertRunInput('npm dev', 4, 4)).toEqual({
      command: 'npm {{value}} dev',
      selectionStart: 6,
      selectionEnd: 11,
    });
  });

  it('turns selected text into the default, and selects the name', () => {
    const edit = insertRunInput('npm run dev -- --port 3000', 22, 26);

    expect(edit.command).toBe('npm run dev -- --port {{value=3000}}');
    expect(edit.command.slice(edit.selectionStart, edit.selectionEnd)).toBe('value');
  });

  it('keeps the whitespace around a selection outside the default', () => {
    expect(insertRunInput('a  3000  b', 2, 8).command).toBe('a  {{value=3000}}  b');
  });

  it('leaves a selection with braces, or only spaces, in place and inserts after it', () => {
    expect(insertRunInput('echo {x}', 0, 8).command).toBe('echo {x} {{value}}');
    expect(insertRunInput('a   b', 1, 4).command).toBe('a   {{value}} b');
  });

  it('puts the caret after a placeholder it lands inside', () => {
    expect(insertRunInput('{{port}}', 4, 4).command).toBe('{{port}} {{value}}');
  });

  it('names a new input value2, value3 and so on when value is taken', () => {
    expect(insertRunInput('{{value}}', 9, 9).command).toBe('{{value}} {{value2}}');
    expect(insertRunInput('{{value}} {{value2}}', 20, 20).command).toBe(
      '{{value}} {{value2}} {{value3}}',
    );
  });

  it('clamps offsets to the command', () => {
    expect(insertRunInput('ab', 99, 99).command).toBe('ab {{value}}');
    expect(insertRunInput('ab', -5, -5).command).toBe('{{value}} ab');
  });
});

describe('runCommandSummary', () => {
  it('names a required input in angle brackets and an optional one in square brackets', () => {
    expect(runCommandSummary('npm run dev -- --port {{port=3000}} {{args?}}')).toBe(
      'npm run dev -- --port <port> [args]',
    );
  });

  it('leaves a plain command and a Go template as they are', () => {
    expect(runCommandSummary('pnpm dev')).toBe('pnpm dev');
    expect(runCommandSummary('docker ps --format "{{.Names}}"')).toBe(
      'docker ps --format "{{.Names}}"',
    );
  });
});

describe('project run command labels', () => {
  it('shows the environment name, or the readable command when it has no name', () => {
    const template = 'npm run dev -- --port {{port=3000}}';

    expect(projectRunCommandTitle({ id: 'a', label: 'serve', command: template })).toBe('serve');
    expect(projectRunCommandTitle({ id: 'b', label: '', command: template })).toBe(
      'npm run dev -- --port <port>',
    );
    expect(projectRunCommandTitle({ id: 'c', label: ' ', command: 'pnpm dev' })).toBe('pnpm dev');
  });

  it('puts the readable command in the hint', () => {
    expect(
      projectRunCommandHint({
        id: 'a',
        label: 'serve',
        command: 'npm run dev -- --port {{port=3000}}',
      }),
    ).toBe('serve: npm run dev -- --port <port>');
    expect(projectRunCommandHint({ id: 'b', label: '', command: 'pnpm dev' })).toBe('pnpm dev');
  });
});
