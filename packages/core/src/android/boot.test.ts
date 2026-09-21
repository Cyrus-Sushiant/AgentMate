import { describe, expect, it } from 'vitest';
import {
  BOOT_STAGES,
  bootProgressFor,
  bootStageLabel,
  parseBootAnim,
  parseBootCompleted,
} from './boot.js';

describe('parseBootCompleted', () => {
  it('is true only for a literal 1', () => {
    expect(parseBootCompleted('1\n')).toBe(true);
    expect(parseBootCompleted('  1  ')).toBe(true);
    expect(parseBootCompleted('0\n')).toBe(false);
    // An offline device answers with an error on stdout, which must not read as booted.
    expect(parseBootCompleted('')).toBe(false);
    expect(parseBootCompleted('error: device offline')).toBe(false);
  });
});

describe('parseBootAnim', () => {
  it('reports the boot animation as finished only when init says stopped', () => {
    expect(parseBootAnim('stopped\n')).toBe(true);
    expect(parseBootAnim('running\n')).toBe(false);
    expect(parseBootAnim('')).toBe(false);
  });
});

describe('bootProgressFor', () => {
  it('rises through the stages and ends at 100', () => {
    const values = BOOT_STAGES.map(bootProgressFor);
    expect(values[0]).toBeGreaterThan(0);
    expect(values.at(-1)).toBe(100);
    // Strictly increasing, so the bar never goes backwards while an emulator boots.
    for (let i = 1; i < values.length; i += 1) expect(values[i]).toBeGreaterThan(values[i - 1]);
  });

  it('gives a failed emulator no progress', () => {
    expect(bootProgressFor('failed')).toBe(0);
    expect(bootProgressFor('stopped')).toBe(0);
  });
});

describe('bootStageLabel', () => {
  it('says what is happening in words a person can read', () => {
    expect(bootStageLabel('launching')).toBe('Launching emulator');
    expect(bootStageLabel('connecting')).toBe('Waiting for device');
    expect(bootStageLabel('booting')).toBe('Booting Android');
    expect(bootStageLabel('running')).toBe('Ready');
  });
});
