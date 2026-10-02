import { describe, expect, it } from 'vitest';
import { changeSet, RULES } from '../../../components/deploy/firewall/testing/fixtures';
import {
  changeStateText,
  clock,
  describeChange,
  describeSpec,
  draftFromRule,
  portsText,
  secondsLeft,
  sourceText,
} from './format';

/** The Firewall section's words, so a rule, a change and a countdown read the same everywhere. */

describe('firewall words', () => {
  it('writes ports, ranges and sources', () => {
    expect(portsText({})).toBe('Any port');
    expect(portsText({ port: 22 })).toBe('22');
    expect(portsText({ port: 22, portTo: 22 })).toBe('22');
    expect(portsText({ port: 6000, portTo: 6007 })).toBe('6000-6007');
    expect(sourceText({})).toBe('Anywhere');
    expect(sourceText({ source: '10.0.0.0/8' })).toBe('10.0.0.0/8');
  });

  it('describes rules and staged changes', () => {
    expect(describeSpec({ action: 'deny', protocol: 'any', source: '203.0.113.7' })).toBe(
      'Deny all traffic from 203.0.113.7',
    );
    expect(describeSpec({ action: 'limit', protocol: 'udp', port: 51820 })).toBe(
      'Limit port 51820 UDP',
    );
    expect(describeChange({ kind: 'addRule' }, RULES)).toBe('Add a rule');
    expect(describeChange({ kind: 'removeRule', ruleId: 'r2' }, RULES)).toBe(
      'Remove: Allow port 443 TCP',
    );
    expect(describeChange({ kind: 'removeRule', ruleId: 'gone' }, RULES)).toBe('Remove a rule');
    expect(describeChange({ kind: 'setDefaultIncoming', policy: 'reject' }, RULES)).toBe(
      'Incoming by default: Reject',
    );
    expect(describeChange({ kind: 'setDefaultIncoming' }, RULES)).toBe('Incoming by default: Deny');
    expect(describeChange({ kind: 'enable' }, RULES)).toBe('Turn the firewall on');
    expect(describeChange({ kind: 'disable' }, RULES)).toBe('Turn the firewall off');
  });

  it('fills the rule form from a rule, or with a fresh rule', () => {
    expect(draftFromRule()).toEqual({
      action: 'allow',
      protocol: 'tcp',
      ports: '',
      source: '',
      comment: '',
    });
    expect(draftFromRule(RULES[2])).toEqual({
      action: 'allow',
      protocol: 'tcp',
      ports: '5432',
      source: '10.0.0.0/8',
      comment: 'app servers',
    });
    expect(draftFromRule(RULES[3])).toMatchObject({ ports: '', protocol: 'any' });
  });

  it('counts down in whole seconds and never below zero', () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(10_000, 9_001)).toBe(1);
    expect(secondsLeft(10_000, 12_000)).toBe(0);
    expect(clock(60)).toBe('1:00');
    expect(clock(7)).toBe('0:07');
  });

  it('says how each change set ended', () => {
    const ended = (fields: Parameters<typeof changeSet>[0]) => changeStateText(changeSet(fields));
    expect(ended({ state: 'applying' })).toBe('Applying');
    expect(ended({})).toBe('Waiting to be kept');
    expect(ended({ state: 'confirmed' })).toBe('Kept');
    expect(ended({ state: 'rolledBack', rolledBackBy: 'timer' })).toMatch(/nobody kept it/);
    expect(ended({ state: 'rolledBack', rolledBackBy: 'user' })).toBe('Reverted');
    expect(ended({ state: 'rolledBack', rolledBackBy: 'restart' })).toMatch(/core restarted/);
    expect(ended({ state: 'rolledBack', rolledBackBy: 'applyFailed' })).toMatch(/did not apply/);
    expect(ended({ state: 'rollbackFailed' })).toBe('Rollback failed');
    expect(ended({ state: 'failed' })).toBe('Failed');
  });
});
