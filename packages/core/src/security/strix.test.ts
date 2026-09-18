import { describe, expect, it } from 'vitest';
import { parseStrixRun } from './strix.js';

/**
 * The Strix run JSON is not a published contract, so the parser accepts several key spellings.
 * These tests pin every spelling it claims to accept: a rename upstream should fail here rather
 * than silently produce an empty report.
 */

describe('parseStrixRun', () => {
  it('reads a full vulnerability into the shared finding shape', () => {
    const findings = parseStrixRun({
      vulnerabilities: [
        {
          id: 'idor-orders',
          title: 'IDOR on the orders endpoint',
          severity: 'critical',
          description: 'Any authenticated user can read another user order by changing the id.',
          file: 'src/routes/orders.ts',
          line: 88,
          cwe: ['CWE-639'],
          owasp: ['A01:2021'],
          remediation: 'Check the order owner against the session user.',
          proof_of_concept: 'GET /api/orders/1042\n200 OK',
          url: 'http://localhost:3000/api/orders/1042',
        },
      ],
    });
    expect(findings).toEqual([
      {
        id: 'strix-1',
        scannerId: 'strix',
        ruleId: 'idor-orders',
        title: 'IDOR on the orders endpoint',
        detail:
          'Any authenticated user can read another user order by changing the id.\n\nTarget: http://localhost:3000/api/orders/1042',
        severity: 'critical',
        nativeSeverity: 'critical',
        kind: 'dast',
        file: 'src/routes/orders.ts',
        line: 88,
        endLine: null,
        // The proof of concept is the reason to run a dynamic scanner, so it takes the excerpt
        // slot where the report already renders a monospace block.
        excerpt: 'GET /api/orders/1042\n200 OK',
        cwe: ['CWE-639'],
        owasp: ['A01:2021'],
        cve: null,
        packageName: null,
        installedVersion: null,
        fixedVersion: null,
        helpUri: null,
        remediation: 'Check the order owner against the session user.',
        redacted: false,
      },
    ]);
  });

  it('accepts a bare array as well as the three container keys', () => {
    const vuln = { title: 'Reflected XSS', severity: 'high' };
    expect(parseStrixRun([vuln])[0].title).toBe('Reflected XSS');
    expect(parseStrixRun({ vulnerabilities: [vuln] })[0].title).toBe('Reflected XSS');
    expect(parseStrixRun({ findings: [vuln] })[0].title).toBe('Reflected XSS');
    expect(parseStrixRun({ results: [vuln] })[0].title).toBe('Reflected XSS');
  });

  it('prefers vulnerabilities over the other container keys', () => {
    const findings = parseStrixRun({
      vulnerabilities: [{ title: 'From vulnerabilities' }],
      findings: [{ title: 'From findings' }],
      results: [{ title: 'From results' }],
    });
    expect(findings.map((f) => f.title)).toEqual(['From vulnerabilities']);
  });

  it('accepts either spelling of every optional field', () => {
    const findings = parseStrixRun([
      {
        name: 'Named rather than titled',
        detail: 'Detail rather than description',
        file_path: 'src/a.ts',
        line_number: 3,
        poc: 'proof from poc',
        fix: 'fix rather than remediation',
        endpoint: 'http://localhost:3000/a',
      },
      {
        summary: 'Summary rather than detail',
        path: 'src/b.ts',
        evidence: 'proof from evidence',
        mitigation: 'mitigation rather than fix',
      },
      { reproduction: 'proof from reproduction' },
    ]);
    expect(findings[0]).toMatchObject({
      title: 'Named rather than titled',
      detail: 'Detail rather than description\n\nTarget: http://localhost:3000/a',
      file: 'src/a.ts',
      line: 3,
      excerpt: 'proof from poc',
      remediation: 'fix rather than remediation',
    });
    expect(findings[1]).toMatchObject({
      detail: 'Summary rather than detail',
      file: 'src/b.ts',
      excerpt: 'proof from evidence',
      remediation: 'mitigation rather than fix',
    });
    expect(findings[2].excerpt).toBe('proof from reproduction');
  });

  it('falls back to placeholder identifiers rather than dropping the finding', () => {
    // A finding with no id or title is still a finding the user should see.
    const [finding] = parseStrixRun([{ severity: 'high' }]);
    expect(finding).toMatchObject({
      id: 'strix-1',
      ruleId: 'strix-finding',
      title: 'Vulnerability',
      detail: '',
      file: null,
      line: null,
      excerpt: null,
      remediation: null,
    });
  });

  it('treats a blank string the same as a missing one', () => {
    const [finding] = parseStrixRun([{ title: '   ', description: '  ', file: '', id: ' ' }]);
    expect(finding.title).toBe('Vulnerability');
    expect(finding.detail).toBe('');
    expect(finding.file).toBeNull();
    expect(finding.ruleId).toBe('strix-finding');
  });

  it('adds the target on its own when there is no description', () => {
    const [finding] = parseStrixRun([{ url: 'http://localhost:3000/login' }]);
    expect(finding.detail).toBe('Target: http://localhost:3000/login');
  });

  it('maps the severity word and keeps the original alongside it', () => {
    const [moderate] = parseStrixRun([{ severity: 'moderate' }]);
    expect(moderate).toMatchObject({ severity: 'medium', nativeSeverity: 'moderate' });
    const [missing] = parseStrixRun([{}]);
    expect(missing).toMatchObject({ severity: 'medium', nativeSeverity: null });
  });

  it('normalizes cwe and owasp from a single string or a list', () => {
    const [single] = parseStrixRun([{ cwe: 'CWE-79', owasp: 'A03:2021' }]);
    expect(single.cwe).toEqual(['CWE-79']);
    expect(single.owasp).toEqual(['A03:2021']);

    // A bare number is the other shape Strix has emitted, and it means the same thing.
    const [list] = parseStrixRun([{ cwe: ['89', ' CWE-79 ', ''], owasp: [' A01 ', ''] }]);
    expect(list.cwe).toEqual(['CWE-89', 'CWE-79']);
    expect(list.owasp).toEqual(['A01']);

    // Nothing numeric to read, so the text is kept as it came rather than being mangled.
    const [text] = parseStrixRun([{ cwe: 'unknown' }]);
    expect(text.cwe).toEqual(['unknown']);
  });

  it('numbers findings in input order', () => {
    const findings = parseStrixRun([{ title: 'a' }, { title: 'b' }, { title: 'c' }]);
    expect(findings.map((f) => f.id)).toEqual(['strix-1', 'strix-2', 'strix-3']);
  });

  it('returns nothing for input it cannot read', () => {
    expect(parseStrixRun(null)).toEqual([]);
    expect(parseStrixRun(undefined)).toEqual([]);
    expect(parseStrixRun({})).toEqual([]);
    expect(parseStrixRun({ vulnerabilities: [] })).toEqual([]);
    // A container key holding something that is not a list is not worth guessing about.
    expect(parseStrixRun({ vulnerabilities: 'none found' })).toEqual([]);
  });
});
