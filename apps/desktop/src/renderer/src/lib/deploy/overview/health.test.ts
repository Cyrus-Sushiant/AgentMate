import {
  metricsSample,
  sampleAlert,
  sampleServices,
  sampleSystemInfo,
  sampleUpdates,
} from '@shared/deploy/testing/fakeCoreData';
import { describe, expect, it } from 'vitest';
import { healthScore } from './health';

const GIB = 1024 ** 3;

function calm() {
  return {
    ...metricsSample(1_000),
    cpuPercent: 12,
    load1: 0.3,
    memoryUsedBytes: 2 * GIB,
    swapUsedBytes: 0,
  };
}

describe('healthScore', () => {
  it('has no score before the first sample', () => {
    expect(healthScore({})).toBeNull();
  });

  it('gives a quiet server 100 and calls it healthy', () => {
    const health = healthScore({
      sample: calm(),
      info: sampleSystemInfo(),
      updates: sampleUpdates({ securityCount: 0 }),
      alerts: [],
      services: sampleServices(),
    });
    expect(health).toEqual({ score: 100, band: 'good', label: 'Healthy', findings: [] });
  });

  it('takes points off for busy hardware, averaged over the recent samples', () => {
    const busy = {
      ...calm(),
      cpuPercent: 95,
      memoryUsedBytes: 7.6 * GIB,
      swapUsedBytes: 1.5 * GIB,
    };
    const health = healthScore({
      sample: busy,
      recent: [busy, { ...busy, cpuPercent: 75 }],
      info: sampleSystemInfo({
        disks: [
          {
            mountPoint: '/',
            device: 'a',
            fileSystem: 'ext4',
            totalBytes: 100,
            usedBytes: 50,
            availableBytes: 50,
          },
          {
            mountPoint: '/data',
            device: 'b',
            fileSystem: 'ext4',
            totalBytes: 100,
            usedBytes: 95,
            availableBytes: 5,
          },
          {
            mountPoint: '/boot',
            device: 'c',
            fileSystem: 'vfat',
            totalBytes: 0,
            usedBytes: 0,
            availableBytes: 0,
          },
        ],
      }),
    });
    expect(health?.findings).toEqual([
      { label: 'Processor at 85%', points: 10 },
      { label: 'Memory at 95%', points: 20 },
      { label: 'Swap at 75%', points: 5 },
      { label: 'Disk /data at 95%', points: 25 },
    ]);
    expect(health?.score).toBe(40);
    expect(health?.band).toBe('poor');
    expect(health?.label).toBe('In trouble');
  });

  it('reads the disk from the sample when the facts are not in yet, and load per core', () => {
    const sample = { ...calm(), diskUsedBytes: 85, diskTotalBytes: 100, load1: 10 };
    const health = healthScore({ sample, info: sampleSystemInfo({ disks: [] }) });
    expect(health?.findings).toEqual([
      { label: 'Disk / at 85%', points: 10 },
      { label: 'Load 10.00 on 4 cores', points: 10 },
    ]);
    expect(
      healthScore({ sample: { ...calm(), load1: 6 }, info: sampleSystemInfo() })?.findings,
    ).toEqual([{ label: 'Load 6.00 on 4 cores', points: 5 }]);
  });

  it('counts open alerts, failed services and housekeeping, and calls a dip a look', () => {
    const failed = { ...sampleServices()[1], state: 'failed' as const };
    const health = healthScore({
      sample: { ...calm(), swapTotalBytes: 0 },
      info: sampleSystemInfo({
        rebootRequired: true,
        timeSync: { synchronized: false },
      }),
      updates: sampleUpdates({ securityCount: 3 }),
      alerts: [
        sampleAlert({ id: 1, severity: 'critical' }),
        sampleAlert({ id: 2, severity: 'warning' }),
        sampleAlert({ id: 3, severity: 'warning', resolvedAtUnixMs: 5 }),
        sampleAlert({ id: 4, severity: 'info' }),
      ],
      services: [failed],
    });
    expect(health?.findings).toEqual([
      { label: '1 critical alert', points: 20 },
      { label: '1 warning', points: 10 },
      { label: 'Docker failed', points: 10 },
      { label: '3 security updates waiting', points: 5 },
      { label: 'A reboot is waiting', points: 5 },
      { label: 'The clock is not in sync', points: 5 },
    ]);
    expect(health?.score).toBe(45);
  });

  it('caps what many alerts cost and never goes below zero', () => {
    const alerts = [1, 2, 3].flatMap((id) => [
      sampleAlert({ id, severity: 'critical' }),
      sampleAlert({ id: id + 10, severity: 'warning' }),
    ]);
    const health = healthScore({
      sample: { ...calm(), cpuPercent: 99, memoryUsedBytes: 8 * GIB, diskUsedBytes: 80 * GIB },
      alerts,
      updates: sampleUpdates({ securityCount: 1, rebootRequired: true }),
      services: [
        { ...sampleServices()[1], state: 'failed' },
        { ...sampleServices()[2], state: 'failed' },
        { ...sampleServices()[0], state: 'failed' },
      ],
    });
    expect(health?.findings.find((f) => f.label === '3 critical alerts')?.points).toBe(30);
    expect(health?.findings.find((f) => f.label === '3 warnings')?.points).toBe(20);
    expect(health?.findings.find((f) => f.label.endsWith('failed'))?.points).toBe(20);
    expect(health?.findings.find((f) => f.label === '1 security update waiting')).toBeTruthy();
    expect(health?.score).toBe(0);
  });

  it('calls a score from 60 to 84 a look', () => {
    expect(
      healthScore({ sample: { ...calm(), cpuPercent: 80, memoryUsedBytes: 6.8 * GIB } }),
    ).toMatchObject({
      score: 80,
      band: 'fair',
      label: 'Needs a look',
    });
  });
});
