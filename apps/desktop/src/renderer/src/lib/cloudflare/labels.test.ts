import { describe, expect, it } from 'vitest';
import {
  accessModeLabel,
  accessTargetLabel,
  formatRemaining,
  relativeName,
  ruleActionLabel,
  splitList,
  ttlLabel,
} from './labels';

describe('Cloudflare labels', () => {
  it('writes TTLs the way people say them', () => {
    expect(ttlLabel(1)).toBe('Auto');
    expect(ttlLabel(60)).toBe('1 min');
    expect(ttlLabel(300)).toBe('5 min');
    expect(ttlLabel(3600)).toBe('1 hr');
    expect(ttlLabel(18000)).toBe('5 hr');
    expect(ttlLabel(86400)).toBe('1 day');
    expect(ttlLabel(90)).toBe('90 s');
  });

  it('shows a record name relative to its zone', () => {
    expect(relativeName('example.com', 'example.com')).toBe('@');
    expect(relativeName('www.example.com', 'example.com')).toBe('www');
    expect(relativeName('other.net', 'example.com')).toBe('other.net');
  });

  it('says how long development mode has left', () => {
    expect(formatRemaining(10800)).toBe('3 h left');
    expect(formatRemaining(5400)).toBe('1 h 30 min left');
    expect(formatRemaining(90)).toBe('2 min left');
    expect(formatRemaining(0)).toBe('');
  });

  it('names rule actions, access modes and targets in words', () => {
    expect(ruleActionLabel('block')).toBe('Block');
    expect(ruleActionLabel('managed_challenge')).toBe('Managed challenge');
    expect(ruleActionLabel('skip')).toBe('Allow (skip the other rules)');
    expect(ruleActionLabel('rewrite')).toBe('rewrite');
    expect(accessModeLabel('whitelist')).toBe('Allow');
    expect(accessModeLabel('js_challenge')).toBe('JavaScript challenge');
    expect(accessTargetLabel('ip_range')).toBe('IP range');
    expect(accessTargetLabel('asn')).toBe('Network (ASN)');
  });

  it('splits a typed list on commas, spaces and new lines', () => {
    expect(splitList('CN, RU\nIR  KP,,')).toEqual(['CN', 'RU', 'IR', 'KP']);
    expect(splitList('   ')).toEqual([]);
  });
});
