import type { SecuritySeverity } from './types.js';

/**
 * Every tool here has its own severity words, and they do not line up. Semgrep only has three
 * levels, Trivy has five, Sonar has five different ones, and CodeQL encodes severity as a numeric
 * CVSS-ish string in rule properties. These tables are the single place that disagreement gets
 * resolved, so the report can sort a Trivy CVE against a Semgrep rule and mean something by it.
 */

/** SARIF's own level enum. Only three of these are real severities; 'none' is a pass result. */
export function fromSarifLevel(level: string | undefined): SecuritySeverity {
  switch (level?.toLowerCase()) {
    case 'error':
      return 'high';
    case 'warning':
      return 'medium';
    case 'note':
      return 'low';
    case 'none':
      return 'info';
    default:
      // SARIF says a missing level defaults to 'warning' for results that have a rule.
      return 'medium';
  }
}

/**
 * CodeQL and some Semgrep rulesets put a CVSS-style number in properties['security-severity'].
 * GitHub's own code-scanning thresholds are the bands used here, so a finding lands in the same
 * bucket the GitHub UI would put it in.
 */
export function fromSecuritySeverityScore(
  raw: string | number | undefined,
): SecuritySeverity | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const score = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(score)) return null;
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}

/** Semgrep's three-level vocabulary, which it also mirrors onto SARIF levels. */
export function fromSemgrepSeverity(raw: string | undefined): SecuritySeverity {
  switch (raw?.toUpperCase()) {
    case 'ERROR':
      return 'high';
    case 'WARNING':
      return 'medium';
    case 'INFO':
      return 'low';
    default:
      return 'medium';
  }
}

/** Trivy's CVE severities, which map straight across. */
export function fromTrivySeverity(raw: string | undefined): SecuritySeverity {
  switch (raw?.toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    case 'UNKNOWN':
      return 'info';
    default:
      return 'medium';
  }
}

/**
 * SonarQube's issue severities. BLOCKER and CRITICAL both mean "do not ship", but only BLOCKER
 * earns 'critical' here so the top band stays meaningful next to a CVSS 9.8 CVE from Trivy.
 */
export function fromSonarSeverity(raw: string | undefined): SecuritySeverity {
  switch (raw?.toUpperCase()) {
    case 'BLOCKER':
      return 'critical';
    case 'CRITICAL':
      return 'high';
    case 'MAJOR':
      return 'medium';
    case 'MINOR':
      return 'low';
    case 'INFO':
      return 'info';
    default:
      return 'medium';
  }
}

/**
 * Sonar's newer "impact" model reports softwareQuality + severity instead of the legacy field.
 * Recent Community Build versions send both, but only impacts are guaranteed going forward.
 */
export function fromSonarImpactSeverity(raw: string | undefined): SecuritySeverity {
  switch (raw?.toUpperCase()) {
    case 'BLOCKER':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    case 'INFO':
      return 'info';
    default:
      return 'medium';
  }
}

/** Strix reports plain severity words on each validated vulnerability. */
export function fromStrixSeverity(raw: string | undefined): SecuritySeverity {
  switch (raw?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
    case 'moderate':
      return 'medium';
    case 'low':
      return 'low';
    case 'info':
    case 'informational':
      return 'info';
    default:
      return 'medium';
  }
}
