import type { SecurityFinding, SecuritySeverity, SecurityVerdict } from './types.js';
import { SECURITY_SEVERITIES } from './types.js';

/**
 * Scoring a codebase is not the same problem as scoring a single skill file.
 *
 * The skills audit collapses to the worst severity per rule, which is right when the thing being
 * scored is one document. Here it would be actively misleading: 300 SQL injection hits across 12
 * rules would score identically to 12. So this counts findings, but with a logarithmic curve, so
 * the difference between 1 and 10 criticals moves the score a lot while the difference between
 * 200 and 400 lows barely moves it at all. One noisy rule cannot zero the score on its own.
 */

const SEVERITY_WEIGHT: Record<SecuritySeverity, number> = {
  critical: 34,
  high: 18,
  medium: 7,
  low: 2,
  info: 0,
};

/**
 * A Sonar hotspot is explicitly "a human should look at this", not a confirmed bug, so it counts
 * for a quarter. Everything else counts in full.
 */
function weightOf(finding: SecurityFinding): number {
  return finding.kind === 'hotspot' ? 0.25 : 1;
}

export function countSecurityFindingsBySeverity(
  findings: SecurityFinding[],
): Record<SecuritySeverity, number> {
  const counts: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

export function scoreSecurityFindings(findings: SecurityFinding[]): {
  score: number;
  verdict: SecurityVerdict;
  counts: Record<SecuritySeverity, number>;
} {
  const counts = countSecurityFindingsBySeverity(findings);

  const weighted: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) weighted[finding.severity] += weightOf(finding);

  let penalty = 0;
  for (const severity of SECURITY_SEVERITIES) {
    const count = weighted[severity];
    if (count <= 0) continue;
    penalty += SEVERITY_WEIGHT[severity] * Math.log2(1 + count);
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  let verdict: SecurityVerdict =
    score >= 90 ? 'safe' : score >= 70 ? 'caution' : score >= 40 ? 'risky' : 'dangerous';

  // A single confirmed critical should never read as "nothing serious found", however small the
  // rest of the report is.
  const criticals = weighted.critical;
  if (criticals >= 1 && (verdict === 'safe' || verdict === 'caution')) verdict = 'risky';
  if (criticals >= 2 && verdict !== 'dangerous') verdict = 'dangerous';
  if (weighted.high >= 1 && verdict === 'safe') verdict = 'caution';

  return { score, verdict, counts };
}

/** Worst first, then by file so a reader walks one file at a time within a severity. */
export function sortSecurityFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const rank = (severity: SecuritySeverity): number => SECURITY_SEVERITIES.indexOf(severity);
  return [...findings].sort((a, b) => {
    const bySeverity = rank(a.severity) - rank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    const byFile = (a.file ?? '').localeCompare(b.file ?? '');
    if (byFile !== 0) return byFile;
    return (a.line ?? 0) - (b.line ?? 0);
  });
}
