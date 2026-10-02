import { describe, expect, it } from 'vitest';
import {
  bindingAddress,
  describeBinding,
  folderName,
  formatDuration,
  isPublicBinding,
  linesOfStep,
  needsAcknowledgment,
  orderedSteps,
  sortRisks,
  stepDuration,
  suggestAppName,
} from './format';

describe('apps format', () => {
  it('puts the worst risks first and keeps the linter order within a severity', () => {
    const risks = [
      { id: 'a', severity: 'low' as const },
      { id: 'b', severity: 'critical' as const },
      { id: 'c', severity: 'medium' as const },
      { id: 'd', severity: 'critical' as const },
    ];
    expect(sortRisks(risks).map((risk) => risk.id)).toEqual(['b', 'd', 'c', 'a']);
    expect(needsAcknowledgment({ severity: 'low' })).toBe(false);
    expect(needsAcknowledgment({ severity: 'medium' })).toBe(true);
  });

  it('fills in the steps the core has not reached yet', () => {
    const steps = orderedSteps([{ kind: 'pull', state: 'running' }]);
    expect(steps.map((step) => `${step.kind}:${step.state}`)).toEqual([
      'validate:pending',
      'pull:running',
      'build:pending',
      'up:pending',
      'health:pending',
    ]);
  });

  it("picks a step's lines by their sequence numbers", () => {
    const lines = [1, 2, 3, 4, 5].map((seq) => ({
      seq,
      atUnixMs: seq,
      source: 'out' as const,
      text: `line ${seq}`,
    }));
    expect(linesOfStep(lines, { kind: 'pull', state: 'pending' })).toEqual([]);
    expect(
      linesOfStep(lines, { kind: 'pull', state: 'succeeded', firstLogSeq: 2, lastLogSeq: 3 }).map(
        (line) => line.seq,
      ),
    ).toEqual([2, 3]);
    expect(
      linesOfStep(lines, { kind: 'up', state: 'running', firstLogSeq: 4 }).map((line) => line.seq),
    ).toEqual([4, 5]);
  });

  it('writes durations people read', () => {
    expect(formatDuration(-5)).toBe('0.0 s');
    expect(formatDuration(400)).toBe('0.4 s');
    expect(formatDuration(12_300)).toBe('12 s');
    expect(formatDuration(185_000)).toBe('3 min 05 s');
    expect(formatDuration(3_720_000)).toBe('1 h 02 min');
    expect(stepDuration({ kind: 'up', state: 'pending' }, 10)).toBeNull();
    expect(stepDuration({ kind: 'up', state: 'running', startedAtUnixMs: 4 }, 10)).toBe(6);
    expect(
      stepDuration({ kind: 'up', state: 'succeeded', startedAtUnixMs: 4, finishedAtUnixMs: 7 }, 10),
    ).toBe(3);
  });

  it('says where a port can be reached from', () => {
    const port = { target: 80, protocol: 'tcp' as const, published: '8080' };
    expect(bindingAddress({ ...port, hostIp: null })).toBe('Every address');
    expect(bindingAddress({ ...port, hostIp: '::' })).toBe('Every address');
    expect(bindingAddress({ ...port, hostIp: '127.0.0.1' })).toBe('This server only');
    expect(bindingAddress({ ...port, hostIp: '10.0.0.4' })).toBe('10.0.0.4');
    expect(isPublicBinding({ ...port, hostIp: '127.0.0.1' })).toBe(false);
    expect(isPublicBinding({ ...port, hostIp: undefined })).toBe(true);
    expect(describeBinding({ ...port, hostIp: null })).toBe('*:8080 → 80/tcp');
    expect(describeBinding({ ...port, hostIp: '::1', published: null })).toBe('[::1]:any → 80/tcp');
  });

  it('suggests a name the server accepts', () => {
    expect(suggestAppName('My Shop.API')).toBe('my-shop-api');
    expect(suggestAppName('--Hello--')).toBe('hello');
    expect(suggestAppName(null)).toBe('');
    expect(suggestAppName('x'.repeat(80))).toHaveLength(63);
    expect(folderName('C:\\work\\shop\\')).toBe('shop');
    expect(folderName('/home/me/blog')).toBe('blog');
  });
});
