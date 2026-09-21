import { describe, expect, it } from 'vitest';
import { avdAdvancedFromConfig, avdConfigPatch, parseIni } from './avdConfig.js';

/**
 * The advanced settings, the ones Android Studio hides behind "Show Advanced Settings". They all
 * live in the same `config.ini`, so reading them back and writing them are two halves of one
 * thing: what the dialog shows has to be what the file actually says, or the first save writes
 * a default over something the user set in Studio.
 */

const CONFIG = parseIni(
  [
    'hw.ramSize=2048',
    'vm.heapSize=256',
    'hw.cpu.ncore=4',
    'disk.dataPartition.size=6442450944',
    'sdcard.size=512M',
    'hw.sdCard=yes',
    'hw.camera.front=emulated',
    'hw.camera.back=virtualscene',
    'runtime.network.speed=hsdpa',
    'runtime.network.latency=umts',
    'hw.keyboard=yes',
    'showDeviceFrame=no',
    'fastboot.forceColdBoot=no',
    'hw.gpu.mode=host',
    '',
  ].join('\n'),
);

describe('avdAdvancedFromConfig', () => {
  it('reads back everything the advanced panel can set', () => {
    expect(avdAdvancedFromConfig(CONFIG)).toEqual({
      vmHeapMb: 256,
      cores: 4,
      sdCardMb: 512,
      cameraFront: 'emulated',
      cameraBack: 'virtualscene',
      networkSpeed: 'hsdpa',
      networkLatency: 'umts',
      keyboard: true,
      deviceFrame: false,
      coldBootAlways: false,
    });
  });

  it('reads an SD card size written in gigabytes', () => {
    expect(avdAdvancedFromConfig(parseIni('sdcard.size=2G\n')).sdCardMb).toBe(2048);
    expect(avdAdvancedFromConfig(parseIni('sdcard.size=512 MB\n')).sdCardMb).toBe(512);
  });

  it('reports no SD card as zero rather than as unset', () => {
    // Zero is a real choice in the dialog, so it has to survive the round trip.
    expect(avdAdvancedFromConfig(parseIni('hw.sdCard=no\n')).sdCardMb).toBe(0);
  });

  it('falls back to what the emulator itself defaults to for a sparse config', () => {
    const bare = avdAdvancedFromConfig({});
    expect(bare).toMatchObject({
      cores: 1,
      cameraFront: 'none',
      cameraBack: 'none',
      networkSpeed: 'full',
      networkLatency: 'none',
      keyboard: true,
      coldBootAlways: false,
    });
    expect(bare.vmHeapMb).toBeNull();
  });
});

describe('avdConfigPatch for the advanced settings', () => {
  it('writes the performance group', () => {
    expect(avdConfigPatch({ vmHeapMb: 512, cores: 4, coldBootAlways: true })).toEqual({
      'vm.heapSize': '512',
      'hw.cpu.ncore': '4',
      'fastboot.forceColdBoot': 'yes',
    });
  });

  it('writes an SD card size the emulator understands, and turns it off at zero', () => {
    expect(avdConfigPatch({ sdCardMb: 1024 })).toEqual({
      'sdcard.size': '1024M',
      'hw.sdCard': 'yes',
    });
    // No size and no card are the same choice, and both keys have to agree.
    expect(avdConfigPatch({ sdCardMb: 0 })).toEqual({ 'sdcard.size': '0M', 'hw.sdCard': 'no' });
  });

  it('writes the camera and network groups', () => {
    expect(
      avdConfigPatch({
        cameraFront: 'webcam0',
        cameraBack: 'none',
        networkSpeed: 'edge',
        networkLatency: 'gprs',
      }),
    ).toEqual({
      'hw.camera.front': 'webcam0',
      'hw.camera.back': 'none',
      'runtime.network.speed': 'edge',
      'runtime.network.latency': 'gprs',
    });
  });

  it('writes the yes/no switches the way the emulator spells them', () => {
    expect(avdConfigPatch({ keyboard: false, deviceFrame: true })).toEqual({
      'hw.keyboard': 'no',
      showDeviceFrame: 'yes',
    });
  });

  it('refuses values that would make an AVD that cannot boot', () => {
    expect(() => avdConfigPatch({ cores: 0 })).toThrow();
    expect(() => avdConfigPatch({ cores: 99 })).toThrow();
    expect(() => avdConfigPatch({ vmHeapMb: 4 })).toThrow();
    expect(() => avdConfigPatch({ sdCardMb: -1 })).toThrow();
  });

  it('still writes nothing for an empty edit', () => {
    expect(avdConfigPatch({})).toEqual({});
  });
});
