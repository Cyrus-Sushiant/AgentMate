import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  consolePortFromSerial,
  isEmulatorSerial,
  parseAdbDevices,
  parseGetProp,
} from './adbDevices.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8');

describe('parseAdbDevices', () => {
  const devices = parseAdbDevices(fixture('adb-devices-l.txt'));

  it('drops the header and reads every row', () => {
    expect(devices).toHaveLength(5);
    expect(devices.map((d) => d.serial)).toEqual([
      'emulator-5554',
      'R58M20ABCDE',
      '192.168.1.20:5555',
      '2B141FDH2000XX',
      'emulator-5556',
    ]);
  });

  it('keeps the states adb reports', () => {
    expect(devices[0].state).toBe('device');
    expect(devices[3].state).toBe('unauthorized');
    expect(devices[4].state).toBe('offline');
  });

  it('classifies transport from the serial', () => {
    expect(devices[0].kind).toBe('emulator');
    expect(devices[1].kind).toBe('usb');
    // A host:port serial is a wireless physical device, not an emulator.
    expect(devices[2].kind).toBe('wifi');
  });

  it('reads the -l key:value tail and makes the model readable', () => {
    expect(devices[1].model).toBe('SM A525F');
    expect(devices[1].product).toBe('a52qnaxx');
    expect(devices[1].transportId).toBe('5');
  });

  it('survives the daemon banner and an empty list', () => {
    expect(parseAdbDevices(fixture('adb-devices-empty.txt'))).toEqual([]);
    expect(parseAdbDevices('')).toEqual([]);
  });
});

describe('isEmulatorSerial / consolePortFromSerial', () => {
  it('recognises emulator serials only', () => {
    expect(isEmulatorSerial('emulator-5554')).toBe(true);
    expect(isEmulatorSerial('192.168.1.20:5555')).toBe(false);
    expect(isEmulatorSerial('R58M20ABCDE')).toBe(false);
  });

  it('pulls the console port out', () => {
    expect(consolePortFromSerial('emulator-5554')).toBe(5554);
    expect(consolePortFromSerial('R58M20ABCDE')).toBeNull();
  });
});

describe('parseGetProp', () => {
  it('reads the multi-prop output shape', () => {
    const out =
      '[ro.product.model]: [Pixel 7]\n[ro.build.version.release]: [14]\n[ro.build.version.sdk]: [34]\n';
    expect(parseGetProp(out)).toEqual({
      'ro.product.model': 'Pixel 7',
      'ro.build.version.release': '14',
      'ro.build.version.sdk': '34',
    });
  });

  it('reads a single bare value', () => {
    expect(parseGetProp('1\n')).toEqual({ value: '1' });
  });
});
