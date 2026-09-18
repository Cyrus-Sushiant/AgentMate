import { describe, expect, it } from 'vitest';
import {
  fromSarifLevel,
  fromSecuritySeverityScore,
  fromSemgrepSeverity,
  fromSonarImpactSeverity,
  fromSonarSeverity,
  fromStrixSeverity,
  fromTrivySeverity,
} from './severity.js';
import type { SecuritySeverity } from './types.js';

/**
 * Every one of these mappers is the only place a tool's vocabulary is translated, so a silent
 * change here re-grades an entire report. The tables below are the contract.
 */

describe('fromSarifLevel', () => {
  const cases: [string | undefined, SecuritySeverity][] = [
    ['error', 'high'],
    ['warning', 'medium'],
    ['note', 'low'],
    ['none', 'info'],
    // Case is not contractual in SARIF, and Semgrep has shipped both spellings.
    ['ERROR', 'high'],
    ['Note', 'low'],
    // SARIF says a missing or unknown level defaults to 'warning'.
    [undefined, 'medium'],
    ['', 'medium'],
    ['catastrophic', 'medium'],
  ];

  it.each(cases)('maps %s to %s', (level, expected) => {
    expect(fromSarifLevel(level)).toBe(expected);
  });
});

describe('fromSecuritySeverityScore', () => {
  it('uses GitHub code-scanning bands, inclusive at the bottom of each', () => {
    const cases: [string | number, SecuritySeverity][] = [
      [10, 'critical'],
      [9.0, 'critical'],
      ['9.0', 'critical'],
      [8.9, 'high'],
      [7.0, 'high'],
      ['7.0', 'high'],
      [6.9, 'medium'],
      [4.0, 'medium'],
      ['4.0', 'medium'],
      [3.9, 'low'],
      [0, 'low'],
      // A tool that reports a negative score is out of spec, but 'low' is the safe read.
      [-1, 'low'],
    ];
    for (const [raw, expected] of cases) {
      expect(fromSecuritySeverityScore(raw), String(raw)).toBe(expected);
    }
  });

  it('returns null when there is no usable number, so the caller can fall back', () => {
    expect(fromSecuritySeverityScore(undefined)).toBeNull();
    expect(fromSecuritySeverityScore('')).toBeNull();
    expect(fromSecuritySeverityScore('high')).toBeNull();
    expect(fromSecuritySeverityScore(Number.NaN)).toBeNull();
    expect(fromSecuritySeverityScore(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('reads a trailing-garbage string the way parseFloat does', () => {
    // Trivy and some Semgrep packs append units or notes to the number.
    expect(fromSecuritySeverityScore('9.8/10')).toBe('critical');
  });
});

describe('fromSemgrepSeverity', () => {
  const cases: [string | undefined, SecuritySeverity][] = [
    ['ERROR', 'high'],
    ['error', 'high'],
    ['WARNING', 'medium'],
    ['INFO', 'low'],
    // Semgrep has no 'critical', so nothing maps there.
    ['CRITICAL', 'medium'],
    [undefined, 'medium'],
  ];

  it.each(cases)('maps %s to %s', (raw, expected) => {
    expect(fromSemgrepSeverity(raw)).toBe(expected);
  });
});

describe('fromTrivySeverity', () => {
  const cases: [string | undefined, SecuritySeverity][] = [
    ['CRITICAL', 'critical'],
    ['HIGH', 'high'],
    ['MEDIUM', 'medium'],
    ['LOW', 'low'],
    ['UNKNOWN', 'info'],
    ['critical', 'critical'],
    [undefined, 'medium'],
    ['nonsense', 'medium'],
  ];

  it.each(cases)('maps %s to %s', (raw, expected) => {
    expect(fromTrivySeverity(raw)).toBe(expected);
  });
});

describe('fromSonarSeverity', () => {
  const cases: [string | undefined, SecuritySeverity][] = [
    ['BLOCKER', 'critical'],
    // Sonar's CRITICAL is deliberately demoted so the top band stays comparable with a CVSS 9.8.
    ['CRITICAL', 'high'],
    ['MAJOR', 'medium'],
    ['MINOR', 'low'],
    ['INFO', 'info'],
    [undefined, 'medium'],
  ];

  it.each(cases)('maps %s to %s', (raw, expected) => {
    expect(fromSonarSeverity(raw)).toBe(expected);
  });
});

describe('fromSonarImpactSeverity', () => {
  const cases: [string | undefined, SecuritySeverity][] = [
    ['BLOCKER', 'critical'],
    // The impact model has its own HIGH, which is not demoted the way legacy CRITICAL is.
    ['HIGH', 'high'],
    ['MEDIUM', 'medium'],
    ['LOW', 'low'],
    ['INFO', 'info'],
    [undefined, 'medium'],
  ];

  it.each(cases)('maps %s to %s', (raw, expected) => {
    expect(fromSonarImpactSeverity(raw)).toBe(expected);
  });
});

describe('fromStrixSeverity', () => {
  const cases: [string | undefined, SecuritySeverity][] = [
    ['critical', 'critical'],
    ['CRITICAL', 'critical'],
    ['high', 'high'],
    ['medium', 'medium'],
    // Strix prose has used both spellings for the middle band.
    ['moderate', 'medium'],
    ['low', 'low'],
    ['info', 'info'],
    ['informational', 'info'],
    [undefined, 'medium'],
  ];

  it.each(cases)('maps %s to %s', (raw, expected) => {
    expect(fromStrixSeverity(raw)).toBe(expected);
  });
});
