import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyIniPatch, avdConfigPatch, avdFromConfig, parseIni } from './avdConfig.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8');

describe('parseIni', () => {
  it('reads key=value lines', () => {
    const ini = parseIni(fixture('config.ini'));
    expect(ini['hw.ramSize']).toBe('2048');
    expect(ini['avd.ini.displayname']).toBe('Pixel 7 API 34');
  });

  it('keeps a value containing an equals sign intact', () => {
    expect(parseIni('key=a=b\n')).toEqual({ key: 'a=b' });
  });

  it('ignores comments and blank lines', () => {
    expect(parseIni('# a comment\n\nkey=value\n')).toEqual({ key: 'value' });
  });
});

describe('avdFromConfig', () => {
  const avd = avdFromConfig('Pixel_7_API_34', parseIni(fixture('config.ini')));

  it('prefers the display name over the id', () => {
    expect(avd.name).toBe('Pixel_7_API_34');
    expect(avd.displayName).toBe('Pixel 7 API 34');
  });

  it('reads the hardware the card shows', () => {
    expect(avd).toMatchObject({
      device: 'pixel_7',
      ramMb: 2048,
      tag: 'google_apis',
      abi: 'x86_64',
      playStore: false,
      gpuMode: 'auto',
    });
  });

  it('turns the data partition size into megabytes', () => {
    expect(avd.storageMb).toBe(6144);
  });

  it('normalizes the Windows separators in image.sysdir and reads the API level from it', () => {
    expect(avd.systemImageDir).toBe('system-images/android-34/google_apis/x86_64');
    expect(avd.api).toBe(34);
  });

  it('falls back to the id when there is no display name', () => {
    expect(avdFromConfig('Bare', {}).displayName).toBe('Bare');
    expect(avdFromConfig('Bare', {}).ramMb).toBeNull();
  });
});

describe('avdConfigPatch', () => {
  it('turns an edit into the config.ini keys avdmanager itself would write', () => {
    expect(
      avdConfigPatch({ displayName: 'Work phone', ramMb: 4096, storageMb: 8192, gpuMode: 'host' }),
    ).toEqual({
      'avd.ini.displayname': 'Work phone',
      'hw.ramSize': '4096',
      // The data partition is stored in bytes even though every UI talks in megabytes.
      'disk.dataPartition.size': String(8192 * 1024 * 1024),
      'hw.gpu.mode': 'host',
      'hw.gpu.enabled': 'yes',
    });
  });

  it('only writes what was actually changed', () => {
    expect(avdConfigPatch({ ramMb: 2048 })).toEqual({ 'hw.ramSize': '2048' });
    expect(avdConfigPatch({})).toEqual({});
  });

  it('turns the graphics mode off rather than writing a bogus one', () => {
    expect(avdConfigPatch({ gpuMode: 'off' })).toEqual({
      'hw.gpu.mode': 'off',
      'hw.gpu.enabled': 'no',
    });
  });

  it('refuses values the emulator would choke on', () => {
    // A zero-byte data partition makes an AVD that cannot boot, and there is no undo.
    expect(() => avdConfigPatch({ ramMb: 0 })).toThrow();
    expect(() => avdConfigPatch({ ramMb: -1 })).toThrow();
    expect(() => avdConfigPatch({ storageMb: 0 })).toThrow();
    expect(() => avdConfigPatch({ displayName: '   ' })).toThrow();
  });
});

describe('applyIniPatch', () => {
  const original = ['# a comment', 'hw.ramSize=2048', 'AvdId=Pixel_7', 'hw.gpu.mode=auto', ''].join(
    '\n',
  );

  it('rewrites a key in place and leaves everything else alone', () => {
    const next = applyIniPatch(original, { 'hw.ramSize': '4096' });

    expect(parseIni(next)).toMatchObject({ 'hw.ramSize': '4096', AvdId: 'Pixel_7' });
    // The file is the AVD's definition, so the comment and the untouched keys stay where they are.
    expect(next).toContain('# a comment');
    expect(next.indexOf('hw.ramSize')).toBeLessThan(next.indexOf('AvdId'));
  });

  it('appends a key that was not there before', () => {
    const next = applyIniPatch(original, { 'avd.ini.displayname': 'Work phone' });

    expect(parseIni(next)['avd.ini.displayname']).toBe('Work phone');
    expect(parseIni(next)['hw.ramSize']).toBe('2048');
  });

  it('writes each key once, however many times it appeared', () => {
    const doubled = ['hw.ramSize=1024', 'hw.ramSize=2048', ''].join('\n');

    const next = applyIniPatch(doubled, { 'hw.ramSize': '4096' });

    expect(next.match(/hw\.ramSize=/g)).toHaveLength(1);
    expect(parseIni(next)['hw.ramSize']).toBe('4096');
  });

  it('gives back the original when there is nothing to change', () => {
    expect(applyIniPatch(original, {})).toBe(original);
  });
});
