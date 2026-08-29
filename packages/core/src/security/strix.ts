import { fromStrixSeverity } from './severity.js';
import type { SecurityFinding } from './types.js';

/**
 * Strix is the odd one out: an autonomous agent that actually exercises the running app rather
 * than reading the source, so its findings come with proof-of-concept evidence instead of a rule
 * id and a line number. It writes a timestamped folder under strix_runs/ containing JSON and
 * Markdown, and the JSON shape is not a published contract, so this reads defensively and accepts
 * several plausible key spellings rather than assuming one.
 */

interface StrixVulnerability {
  id?: string;
  title?: string;
  name?: string;
  severity?: string;
  description?: string;
  detail?: string;
  summary?: string;
  file?: string;
  file_path?: string;
  path?: string;
  line?: number;
  line_number?: number;
  cwe?: string | string[];
  owasp?: string | string[];
  remediation?: string;
  fix?: string;
  mitigation?: string;
  /** The request/response or steps Strix used to prove the issue is real. */
  proof_of_concept?: string;
  poc?: string;
  evidence?: string;
  reproduction?: string;
  url?: string;
  endpoint?: string;
}

interface StrixRun {
  vulnerabilities?: StrixVulnerability[];
  findings?: StrixVulnerability[];
  results?: StrixVulnerability[];
}

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
}

function normalizeCwe(values: string[]): string[] {
  return values.map((v) => {
    const match = /(\d+)/.exec(v);
    return match ? 'CWE-' + match[1] : v;
  });
}

function firstText(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function parseStrixRun(raw: unknown): SecurityFinding[] {
  const run = raw as StrixRun | StrixVulnerability[] | null;
  if (!run) return [];

  const list: StrixVulnerability[] = Array.isArray(run)
    ? run
    : (run.vulnerabilities ?? run.findings ?? run.results ?? []);
  if (!Array.isArray(list)) return [];

  return list.map((vuln, index) => {
    const title = firstText(vuln.title, vuln.name) ?? 'Vulnerability';
    const detail = firstText(vuln.description, vuln.detail, vuln.summary) ?? '';
    // The proof of concept is the whole point of running a dynamic scanner, so it goes into the
    // excerpt slot where the report already renders a monospace block.
    const proof = firstText(vuln.proof_of_concept, vuln.poc, vuln.evidence, vuln.reproduction);
    const target = firstText(vuln.url, vuln.endpoint);

    return {
      id: 'strix-' + (index + 1),
      scannerId: 'strix' as const,
      ruleId: firstText(vuln.id) ?? 'strix-finding',
      title,
      detail: target ? detail + (detail ? '\n\n' : '') + 'Target: ' + target : detail,
      severity: fromStrixSeverity(vuln.severity),
      nativeSeverity: vuln.severity ?? null,
      kind: 'dast' as const,
      file: firstText(vuln.file, vuln.file_path, vuln.path),
      line: vuln.line ?? vuln.line_number ?? null,
      endLine: null,
      excerpt: proof,
      cwe: normalizeCwe(asArray(vuln.cwe)),
      owasp: asArray(vuln.owasp),
      cve: null,
      packageName: null,
      installedVersion: null,
      fixedVersion: null,
      helpUri: null,
      remediation: firstText(vuln.remediation, vuln.fix, vuln.mitigation),
      redacted: false,
    };
  });
}
