import { describe, expect, it } from 'vitest';
import {
  CODEQL_LANGUAGES,
  codeqlLanguageNeedsBuild,
  getSecurityScanner,
  SECURITY_SCANNERS,
  SEMGREP_RULESETS,
} from './scanners.js';
import type { SecurityScannerId } from './types.js';

/**
 * The registry is the one place the picker, the preflight and the runner all read from, so an
 * entry with a missing field breaks a screen rather than a scan. These are the invariants the UI
 * relies on rather than a restatement of the table.
 */

describe('SECURITY_SCANNERS', () => {
  it('has a unique id per scanner', () => {
    const ids = SECURITY_SCANNERS.map((scanner) => scanner.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every scanner the fields the picker card renders', () => {
    for (const scanner of SECURITY_SCANNERS) {
      expect(scanner.name.length, scanner.id).toBeGreaterThan(0);
      expect(scanner.covers.length, scanner.id).toBeGreaterThan(0);
      expect(scanner.estimate.length, scanner.id).toBeGreaterThan(0);
      expect(scanner.kinds.length, scanner.id).toBeGreaterThan(0);
      // The card deep-links to the tool's install entry, so this has to be set even when it
      // happens to equal the scanner id.
      expect(scanner.toolId.length, scanner.id).toBeGreaterThan(0);
      expect(scanner.docsUrl, scanner.id).toMatch(/^https:\/\//);
      expect([1, 2, 3], scanner.id).toContain(scanner.phase);
    }
  });

  it('lists scanners in phase order, since the phase is the run order', () => {
    const phases = SECURITY_SCANNERS.map((scanner) => scanner.phase);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
  });

  it('puts every scanner that costs money in the last phase', () => {
    // A user who has already seen most of the value must be able to cancel before paying.
    const paid = SECURITY_SCANNERS.filter((scanner) => scanner.costsMoney);
    expect(paid.map((scanner) => scanner.id)).toEqual(['strix']);
    for (const scanner of paid) expect(scanner.phase).toBe(3);
  });

  it('describes each scanner distinctly, so the picker explains why to run two', () => {
    const covers = SECURITY_SCANNERS.map((scanner) => scanner.covers);
    expect(new Set(covers).size).toBe(covers.length);
  });
});

describe('getSecurityScanner', () => {
  it('finds every registered scanner by id', () => {
    for (const scanner of SECURITY_SCANNERS) {
      expect(getSecurityScanner(scanner.id)).toBe(scanner);
    }
  });

  it('returns undefined for an id that is no longer registered', () => {
    // Persisted scan records hold scanner ids, so an old record can name a scanner that is gone.
    expect(getSecurityScanner('retired-scanner' as SecurityScannerId)).toBeUndefined();
  });
});

describe('SEMGREP_RULESETS', () => {
  it('offers unique values with a label on each', () => {
    const values = SEMGREP_RULESETS.map((ruleset) => ruleset.value);
    expect(new Set(values).size).toBe(values.length);
    for (const ruleset of SEMGREP_RULESETS) expect(ruleset.label.length).toBeGreaterThan(0);
  });

  it('says which option reaches the network', () => {
    const auto = SEMGREP_RULESETS.find((ruleset) => ruleset.value === 'auto');
    expect(auto?.label).toContain('semgrep.dev');
  });
});

describe('CODEQL_LANGUAGES', () => {
  it('offers unique values with a label on each', () => {
    const values = CODEQL_LANGUAGES.map((language) => language.value);
    expect(new Set(values).size).toBe(values.length);
    for (const language of CODEQL_LANGUAGES) expect(language.label.length).toBeGreaterThan(0);
  });

  it('lists the no-build languages first, which is how the dialog groups them', () => {
    const firstBuilt = CODEQL_LANGUAGES.findIndex((language) => language.needsBuild);
    const lastFree = CODEQL_LANGUAGES.map((l) => l.needsBuild).lastIndexOf(false);
    expect(firstBuilt).toBeGreaterThan(lastFree);
  });
});

describe('codeqlLanguageNeedsBuild', () => {
  it('knows which languages need a build command', () => {
    expect(codeqlLanguageNeedsBuild('javascript-typescript')).toBe(false);
    expect(codeqlLanguageNeedsBuild('python')).toBe(false);
    expect(codeqlLanguageNeedsBuild('java-kotlin')).toBe(true);
    expect(codeqlLanguageNeedsBuild('c-cpp')).toBe(true);
  });

  it('answers false for no language and for one it does not know', () => {
    // Nothing is selected yet, so the dialog must not demand a build command.
    expect(codeqlLanguageNeedsBuild(null)).toBe(false);
    expect(codeqlLanguageNeedsBuild('cobol')).toBe(false);
  });
});
