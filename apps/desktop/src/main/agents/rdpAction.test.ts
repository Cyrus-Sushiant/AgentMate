import { describe, expect, it } from 'vitest';
import {
  buildRdpPrompt,
  formatRdpAction,
  isRiskyRdpAction,
  parseRdpReply,
  type RdpAction,
  riskyReason,
} from './rdpAction';

describe('parseRdpReply', () => {
  it('reads each pointer verb', () => {
    expect(parseRdpReply('CLICK 10 20')).toEqual({ kind: 'click', x: 10, y: 20 });
    expect(parseRdpReply('DOUBLE_CLICK 10 20')).toEqual({ kind: 'double-click', x: 10, y: 20 });
    expect(parseRdpReply('RIGHT_CLICK 10 20')).toEqual({ kind: 'right-click', x: 10, y: 20 });
    expect(parseRdpReply('MOVE 10 20')).toEqual({ kind: 'move', x: 10, y: 20 });
    expect(parseRdpReply('DRAG 1 2 300 400')).toEqual({
      kind: 'drag',
      x1: 1,
      y1: 2,
      x2: 300,
      y2: 400,
    });
  });

  it('ignores the case of the verb', () => {
    expect(parseRdpReply('click 5 6')).toEqual({ kind: 'click', x: 5, y: 6 });
    expect(parseRdpReply('Double_Click 5 6')).toEqual({ kind: 'double-click', x: 5, y: 6 });
    expect(parseRdpReply('key Enter')).toEqual({ kind: 'key', combo: 'enter' });
  });

  it('rounds decimal coordinates', () => {
    expect(parseRdpReply('CLICK 10.4 20.6')).toEqual({ kind: 'click', x: 10, y: 21 });
  });

  it('accepts a comma or parentheses around a point', () => {
    expect(parseRdpReply('CLICK 10, 20')).toEqual({ kind: 'click', x: 10, y: 20 });
    expect(parseRdpReply('CLICK (10, 20)')).toEqual({ kind: 'click', x: 10, y: 20 });
  });

  it('rejects negative or missing coordinates', () => {
    expect(parseRdpReply('CLICK -1 20')).toBeNull();
    expect(parseRdpReply('CLICK 10')).toBeNull();
    expect(parseRdpReply('DRAG 1 2 3')).toBeNull();
    expect(parseRdpReply('MOVE ten twenty')).toBeNull();
  });

  it('reads SCROLL with a default amount and a cap', () => {
    expect(parseRdpReply('SCROLL 100 200 down')).toEqual({
      kind: 'scroll',
      x: 100,
      y: 200,
      direction: 'down',
      amount: 3,
    });
    expect(parseRdpReply('scroll 100 200 UP 5')).toEqual({
      kind: 'scroll',
      x: 100,
      y: 200,
      direction: 'up',
      amount: 5,
    });
    expect(parseRdpReply('SCROLL 1 2 down 500')).toMatchObject({ amount: 20 });
    expect(parseRdpReply('SCROLL 1 2 sideways')).toBeNull();
    expect(parseRdpReply('SCROLL 1 2 down -3')).toBeNull();
  });

  it('reads TYPE with its escapes', () => {
    expect(parseRdpReply('TYPE "hello world"')).toEqual({ kind: 'type', text: 'hello world' });
    expect(parseRdpReply('TYPE "say \\"hi\\"\\nnext\\tcol"')).toEqual({
      kind: 'type',
      text: 'say "hi"\nnext\tcol',
    });
    expect(parseRdpReply('TYPE "back\\\\slash"')).toEqual({ kind: 'type', text: 'back\\slash' });
  });

  it('keeps a lone backslash in TYPE text, like a Windows path', () => {
    expect(parseRdpReply('TYPE "C:\\Users\\me"')).toEqual({ kind: 'type', text: 'C:\\Users\\me' });
  });

  it('rejects TYPE without quotes or with nothing to type', () => {
    expect(parseRdpReply('TYPE hello')).toBeNull();
    expect(parseRdpReply('TYPE ""')).toBeNull();
    expect(parseRdpReply('TYPE "unclosed')).toBeNull();
  });

  it('reads KEY combos and tidies them', () => {
    expect(parseRdpReply('KEY ctrl+s')).toEqual({ kind: 'key', combo: 'ctrl+s' });
    expect(parseRdpReply('KEY Ctrl + Shift + Esc')).toEqual({
      kind: 'key',
      combo: 'ctrl+shift+esc',
    });
    expect(parseRdpReply('KEY')).toBeNull();
    expect(parseRdpReply('KEY press the enter key')).toBeNull();
  });

  it('reads WAIT with a cap', () => {
    expect(parseRdpReply('WAIT 500')).toEqual({ kind: 'wait', ms: 500 });
    expect(parseRdpReply('WAIT 750ms')).toEqual({ kind: 'wait', ms: 750 });
    expect(parseRdpReply('WAIT 60000')).toEqual({ kind: 'wait', ms: 10000 });
    expect(parseRdpReply('WAIT -5')).toBeNull();
  });

  it('reads FINISHED and NEEDS_INPUT', () => {
    expect(parseRdpReply('FINISHED: Notepad is open')).toEqual({
      kind: 'finished',
      message: 'Notepad is open',
    });
    expect(parseRdpReply('FINISHED')).toEqual({ kind: 'finished', message: '' });
    expect(parseRdpReply('NEEDS_INPUT: Which file should I open?')).toEqual({
      kind: 'needs-input',
      message: 'Which file should I open?',
    });
  });

  it('finds the action among prose, backticks and code fences', () => {
    expect(parseRdpReply('The Start button is bottom left.\nCLICK 20 700')).toEqual({
      kind: 'click',
      x: 20,
      y: 700,
    });
    expect(parseRdpReply('`CLICK 20 700`')).toEqual({ kind: 'click', x: 20, y: 700 });
    expect(parseRdpReply('```\nKEY win\n```')).toEqual({ kind: 'key', combo: 'win' });
  });

  it('prefers an action over FINISHED, like the SSH reply parser', () => {
    expect(parseRdpReply('FINISHED: almost\nCLICK 1 2')).toEqual({ kind: 'click', x: 1, y: 2 });
  });

  it('skips prose that only starts like a verb', () => {
    expect(parseRdpReply('Click the OK button next.\nCLICK 400 300')).toEqual({
      kind: 'click',
      x: 400,
      y: 300,
    });
    expect(parseRdpReply('Type the name in the box.\nFINISHED: done')).toEqual({
      kind: 'finished',
      message: 'done',
    });
  });

  it('returns null for an unknown verb or no action at all', () => {
    expect(parseRdpReply('PRESS enter')).toBeNull();
    expect(parseRdpReply('I am not sure what to do.')).toBeNull();
    expect(parseRdpReply('')).toBeNull();
  });
});

describe('formatRdpAction', () => {
  const actions: RdpAction[] = [
    { kind: 'click', x: 1, y: 2 },
    { kind: 'double-click', x: 3, y: 4 },
    { kind: 'right-click', x: 5, y: 6 },
    { kind: 'move', x: 7, y: 8 },
    { kind: 'drag', x1: 1, y1: 2, x2: 3, y2: 4 },
    { kind: 'scroll', x: 9, y: 10, direction: 'down', amount: 3 },
    { kind: 'scroll', x: 9, y: 10, direction: 'up', amount: 7 },
    { kind: 'type', text: 'line one\nsay "hi"\tC:\\temp\\x' },
    { kind: 'key', combo: 'ctrl+alt+delete' },
    { kind: 'wait', ms: 1500 },
  ];

  it('writes the grammar the AI uses', () => {
    expect(formatRdpAction({ kind: 'double-click', x: 3, y: 4 })).toBe('DOUBLE_CLICK 3 4');
    expect(formatRdpAction({ kind: 'right-click', x: 5, y: 6 })).toBe('RIGHT_CLICK 5 6');
    expect(formatRdpAction({ kind: 'scroll', x: 9, y: 10, direction: 'down', amount: 3 })).toBe(
      'SCROLL 9 10 down 3',
    );
    expect(formatRdpAction({ kind: 'type', text: 'a "b"\n' })).toBe('TYPE "a \\"b\\"\\n"');
  });

  it('round trips every action through the parser', () => {
    for (const action of actions) {
      expect(parseRdpReply(formatRdpAction(action)), action.kind).toEqual(action);
    }
  });
});

describe('isRiskyRdpAction', () => {
  it('flags every TYPE', () => {
    expect(isRiskyRdpAction({ kind: 'type', text: 'hello' })).toBe(true);
  });

  it('flags shortcuts that reach outside the current window or delete things', () => {
    for (const combo of [
      'win',
      'meta',
      'cmd',
      'win+r',
      'r+win',
      'windows+r',
      'win+x',
      'alt+f4',
      'ctrl+alt+del',
      'ctrl+alt+delete',
      'ctrl+shift+esc',
      'ctrl+shift+escape',
      'shift+delete',
      'shift+del',
      'delete',
      'Alt+F4',
    ]) {
      expect(isRiskyRdpAction({ kind: 'key', combo }), combo).toBe(true);
    }
  });

  it('lets ordinary keys through', () => {
    for (const combo of ['enter', 'ctrl+s', 'tab', 'esc', 'ctrl+c', 'alt+tab', 'f5', 'win+e']) {
      expect(isRiskyRdpAction({ kind: 'key', combo }), combo).toBe(false);
    }
  });

  it('lets pointer actions and waits through', () => {
    const safe: RdpAction[] = [
      { kind: 'click', x: 1, y: 2 },
      { kind: 'double-click', x: 1, y: 2 },
      { kind: 'right-click', x: 1, y: 2 },
      { kind: 'move', x: 1, y: 2 },
      { kind: 'drag', x1: 1, y1: 2, x2: 3, y2: 4 },
      { kind: 'scroll', x: 1, y: 2, direction: 'down', amount: 3 },
      { kind: 'wait', ms: 100 },
    ];
    for (const action of safe) expect(isRiskyRdpAction(action), action.kind).toBe(false);
  });
});

describe('riskyReason', () => {
  it('warns when typed text looks like a destructive command', () => {
    expect(riskyReason({ kind: 'type', text: 'rm -rf /\n' })).toMatch(/destructive/i);
    expect(riskyReason({ kind: 'type', text: 'Remove-Item C:\\data -Recurse' })).toMatch(
      /destructive/i,
    );
  });

  it('has nothing to add for ordinary text or safe actions', () => {
    expect(riskyReason({ kind: 'type', text: 'hello world' })).toBeUndefined();
    expect(riskyReason({ kind: 'click', x: 1, y: 2 })).toBeUndefined();
    expect(riskyReason({ kind: 'key', combo: 'ctrl+s' })).toBeUndefined();
  });

  it('explains a risky shortcut', () => {
    expect(riskyReason({ kind: 'key', combo: 'alt+f4' })).toContain('alt+f4');
  });
});

describe('buildRdpPrompt', () => {
  const base = {
    task: 'open Notepad and type hello',
    transcript: '',
    frameWidth: 1280,
    frameHeight: 720,
  };

  it('states the task, the frame size and the coordinate space', () => {
    const prompt = buildRdpPrompt({ ...base, imageMode: 'api' });
    expect(prompt).toContain('"open Notepad and type hello"');
    expect(prompt).toContain('1280 x 720');
    expect(prompt).toContain('(0,0)');
    expect(prompt).toMatch(/remote desktop/i);
    expect(prompt).toMatch(/watch/i);
  });

  it('lists the whole grammar', () => {
    const prompt = buildRdpPrompt({ ...base, imageMode: 'api' });
    for (const verb of [
      'CLICK x y',
      'DOUBLE_CLICK x y',
      'RIGHT_CLICK x y',
      'MOVE x y',
      'DRAG x1 y1 x2 y2',
      'SCROLL x y up|down',
      'TYPE "',
      'KEY ',
      'WAIT ',
      'FINISHED:',
      'NEEDS_INPUT:',
    ]) {
      expect(prompt, verb).toContain(verb);
    }
    expect(prompt).toMatch(/exactly one/i);
  });

  it('includes the rules', () => {
    const prompt = buildRdpPrompt({ ...base, imageMode: 'api' });
    expect(prompt).toMatch(/keyboard shortcut/i);
    expect(prompt).toMatch(/click into/i);
    expect(prompt).toMatch(/did not change/i);
    expect(prompt).toMatch(/password/i);
  });

  it('says when nothing has happened yet, and shows the transcript tail otherwise', () => {
    expect(buildRdpPrompt({ ...base, imageMode: 'api' })).toContain('(no actions yet)');
    const long = `${'x'.repeat(7000)}END`;
    const prompt = buildRdpPrompt({ ...base, transcript: long, imageMode: 'api' });
    expect(prompt).toContain('END');
    expect(prompt).toContain('earlier steps truncated');
    expect(prompt).not.toContain('x'.repeat(6500));
  });

  it('lets Claude Code read only the screenshot', () => {
    const prompt = buildRdpPrompt({ ...base, imageMode: 'read-tool' });
    expect(prompt.startsWith('Use the Read tool only to look at ./frame.png.')).toBe(true);
    expect(prompt).toContain('Do not use any other tool');
  });

  it('tells CLIs with an attached image to use no tools', () => {
    for (const imageMode of ['flag', 'mention'] as const) {
      const prompt = buildRdpPrompt({ ...base, imageMode });
      expect(prompt.startsWith('Do not use any tools'), imageMode).toBe(true);
      expect(prompt, imageMode).toMatch(/screenshot is attached/i);
    }
  });

  it('has no tool preamble for an API model', () => {
    const prompt = buildRdpPrompt({ ...base, imageMode: 'api' });
    expect(prompt.startsWith('You are operating')).toBe(true);
    expect(prompt).not.toContain('Read tool');
  });
});
