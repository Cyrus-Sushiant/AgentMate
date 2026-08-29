import { getSecurityScanner } from './scanners.js';
import { sortSecurityFindings } from './score.js';
import type { SecurityFinding, SecurityScanRecord, SecuritySeverity } from './types.js';
import {
  SECURITY_FINDING_KIND_LABEL,
  SECURITY_SEVERITIES,
  SECURITY_SEVERITY_LABEL,
  SECURITY_VERDICT_LABEL,
} from './types.js';

/**
 * The three whole-report copy formats, plus the single-finding one.
 *
 * The AI fix prompt is the one that matters most: it is what turns this from a dashboard into
 * something that actually gets the bugs fixed. It is capped by severity rather than truncated
 * arbitrarily, because handing a model 4000 low-severity style notes and no criticals would be
 * worse than useless.
 */

const DEFAULT_PROMPT_CAP = 60;

function scannerName(finding: SecurityFinding): string {
  return getSecurityScanner(finding.scannerId)?.name ?? finding.scannerId;
}

function locationOf(finding: SecurityFinding): string {
  if (!finding.file) return 'repository-wide';
  return finding.line ? finding.file + ':' + finding.line : finding.file;
}

function severityCountLine(counts: Record<SecuritySeverity, number>): string {
  const parts = SECURITY_SEVERITIES.filter((s) => counts[s] > 0).map(
    (s) => counts[s] + ' ' + SECURITY_SEVERITY_LABEL[s].toLowerCase(),
  );
  return parts.length > 0 ? parts.join(', ') : 'no findings';
}

function fenceFor(file: string | null): string {
  const ext = file?.split('.').pop()?.toLowerCase() ?? '';
  const byExt: Record<string, string> = {
    ts: 'ts',
    tsx: 'tsx',
    js: 'js',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    java: 'java',
    cs: 'csharp',
    php: 'php',
    rs: 'rust',
    sh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    sql: 'sql',
  };
  return byExt[ext] ?? '';
}

/** One finding, rendered the same way everywhere so the single-copy button matches the report. */
export function buildFindingText(finding: SecurityFinding): string {
  const lines: string[] = [];
  lines.push('### [' + SECURITY_SEVERITY_LABEL[finding.severity] + '] ' + finding.title);
  lines.push('');
  lines.push('- Location: `' + locationOf(finding) + '`');
  lines.push('- Rule: `' + finding.ruleId + '` (' + scannerName(finding) + ')');
  lines.push('- Type: ' + SECURITY_FINDING_KIND_LABEL[finding.kind]);
  if (finding.cwe.length > 0) lines.push('- CWE: ' + finding.cwe.join(', '));
  if (finding.owasp.length > 0) lines.push('- OWASP: ' + finding.owasp.join(', '));
  if (finding.cve) lines.push('- CVE: ' + finding.cve);
  if (finding.packageName) {
    const version = finding.installedVersion ? '@' + finding.installedVersion : '';
    const fix = finding.fixedVersion ? ' (fixed in ' + finding.fixedVersion + ')' : '';
    lines.push('- Package: `' + finding.packageName + version + '`' + fix);
  }
  if (finding.helpUri) lines.push('- Reference: ' + finding.helpUri);
  if (finding.redacted) {
    lines.push('- Note: a matched secret was masked. Open the file to see the real value.');
  }

  if (finding.detail && finding.detail !== finding.title) {
    lines.push('');
    lines.push(finding.detail);
  }
  if (finding.excerpt) {
    lines.push('');
    lines.push('```' + fenceFor(finding.file));
    lines.push(finding.excerpt);
    lines.push('```');
  }
  if (finding.remediation) {
    lines.push('');
    lines.push('Suggested fix: ' + finding.remediation);
  }
  return lines.join('\n');
}

/** The human-readable report: a summary table, per-tool status, then grouped findings. */
export function buildSecurityReportMarkdown(record: SecurityScanRecord): string {
  const lines: string[] = [];
  lines.push('# Security scan: ' + record.projectName);
  lines.push('');
  lines.push(
    '**' +
      SECURITY_VERDICT_LABEL[record.verdict] +
      '** (score ' +
      record.score +
      '/100) - ' +
      severityCountLine(record.counts),
  );
  lines.push('');
  lines.push('Scanned ' + new Date(record.createdAt).toLocaleString() + '.');
  if (record.status !== 'complete') {
    lines.push('');
    lines.push('> This run finished as **' + record.status + '**, so it may be incomplete.');
  }
  lines.push('');

  lines.push('## Scanners');
  lines.push('');
  lines.push('| Scanner | Result | Findings | Duration |');
  lines.push('| --- | --- | --- | --- |');
  for (const run of record.runs) {
    const name = getSecurityScanner(run.scannerId)?.name ?? run.scannerId;
    const result = run.status === 'ok' ? 'ok' : run.status + (run.error ? ': ' + run.error : '');
    const seconds = Math.round(run.durationMs / 1000);
    lines.push('| ' + name + ' | ' + result + ' | ' + run.findingCount + ' | ' + seconds + 's |');
  }
  lines.push('');

  if (record.findings.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push(
      'None. That is not a guarantee of safety: it means the scanners that ran did not match anything they know about.',
    );
    return lines.join('\n');
  }

  const sorted = sortSecurityFindings(record.findings);
  for (const severity of SECURITY_SEVERITIES) {
    const group = sorted.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    lines.push('## ' + SECURITY_SEVERITY_LABEL[severity] + ' (' + group.length + ')');
    lines.push('');
    for (const finding of group) {
      lines.push(buildFindingText(finding));
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * The prompt to hand an agent. Front-loads the instruction so it survives truncation, then the
 * highest-severity findings first, capped so this stays inside a sane context budget.
 */
export function buildSecurityFixPrompt(
  record: SecurityScanRecord,
  options?: { cap?: number },
): string {
  const cap = options?.cap ?? DEFAULT_PROMPT_CAP;
  const sorted = sortSecurityFindings(record.findings);
  const included = sorted.slice(0, cap);
  const omitted = sorted.length - included.length;

  const lines: string[] = [];
  lines.push('I ran security scanners on the "' + record.projectName + '" project.');
  lines.push('');
  lines.push('Please fix the findings below. For each one:');
  lines.push('');
  lines.push('1. Open the file at the given line and confirm the finding is real. Some of these');
  lines.push('   are false positives, so say so and move on rather than changing correct code.');
  lines.push('2. If it is real, make the smallest change that actually fixes the root cause,');
  lines.push('   matching the surrounding code style.');
  lines.push('3. Explain briefly what you changed and why.');
  lines.push('');
  lines.push('Work through them worst-first. Do not refactor anything unrelated. If a fix would');
  lines.push('be a breaking change or needs a decision I should make, stop and ask instead.');
  lines.push('');
  lines.push('Summary: ' + severityCountLine(record.counts) + ' (score ' + record.score + '/100).');

  const tools = record.runs
    .filter((r) => r.status === 'ok')
    .map((r) => getSecurityScanner(r.scannerId)?.name ?? r.scannerId);
  if (tools.length > 0) {
    lines.push('Tools that ran: ' + tools.join(', ') + '.');
  }

  const anyRedacted = included.some((f) => f.redacted);
  if (anyRedacted) {
    lines.push('');
    lines.push(
      'Note: matched secret values are masked below. Read the real value from the file yourself,',
    );
    lines.push('and when you fix one, move it to an environment variable and rotate it.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  for (const severity of SECURITY_SEVERITIES) {
    const group = included.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    lines.push('## ' + SECURITY_SEVERITY_LABEL[severity] + ' (' + group.length + ')');
    lines.push('');
    for (const finding of group) {
      lines.push(buildFindingText(finding));
      lines.push('');
    }
  }

  if (omitted > 0) {
    lines.push('---');
    lines.push('');
    lines.push(
      'There are ' +
        omitted +
        ' further lower-severity findings not included here, to keep this prompt a workable size.',
    );
  }

  return lines.join('\n');
}

/** The normalized findings as JSON, for piping into other tooling. */
export function buildSecurityJson(record: SecurityScanRecord): string {
  return JSON.stringify(
    {
      project: record.projectName,
      createdAt: record.createdAt,
      status: record.status,
      verdict: record.verdict,
      score: record.score,
      counts: record.counts,
      runs: record.runs,
      findings: record.findings,
    },
    null,
    2,
  );
}
