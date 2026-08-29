import { fromSonarImpactSeverity, fromSonarSeverity } from './severity.js';
import type { SecurityFinding, SecuritySeverity } from './types.js';

/**
 * SonarQube is the one scanner that does not hand us a file. The scanner CLI uploads its analysis
 * to the server, and the findings come back out of the web API afterwards, from two endpoints that
 * disagree about their own shape: /api/issues/search returns rule violations, /api/hotspots/search
 * returns "security hotspots", which are places a human should look rather than confirmed bugs.
 *
 * Only the security-relevant issues are kept. Sonar reports every code smell it can find, and a
 * thousand naming-convention notes would drown the actual vulnerabilities in this report.
 */

export interface SonarIssue {
  key?: string;
  rule?: string;
  severity?: string;
  component?: string;
  line?: number;
  message?: string;
  type?: string;
  impacts?: { softwareQuality?: string; severity?: string }[];
  tags?: string[];
}

export interface SonarHotspot {
  key?: string;
  ruleKey?: string;
  component?: string;
  line?: number;
  message?: string;
  vulnerabilityProbability?: string;
  securityCategory?: string;
}

/**
 * Sonar addresses files as "projectKey:relative/path". Anything before the first colon is the
 * project key, and what is left is already project-relative POSIX.
 */
export function sonarComponentToFile(component: string | undefined): string | null {
  if (!component) return null;
  const colon = component.indexOf(':');
  const path = colon === -1 ? component : component.slice(colon + 1);
  return path.trim() || null;
}

function issueSeverity(issue: SonarIssue): SecuritySeverity {
  // Newer Community Build versions report `impacts` and are phasing out the flat `severity`.
  // Prefer the security impact when there is one, since a MAJOR maintainability smell and a
  // MAJOR vulnerability are not the same thing.
  const security = issue.impacts?.find((i) => i.softwareQuality?.toUpperCase() === 'SECURITY');
  if (security?.severity) return fromSonarImpactSeverity(security.severity);
  if (issue.severity) return fromSonarSeverity(issue.severity);
  const first = issue.impacts?.[0]?.severity;
  return first ? fromSonarImpactSeverity(first) : 'medium';
}

/** Sonar's own guess at how likely a hotspot is to be a real vulnerability. */
function hotspotSeverity(probability: string | undefined): SecuritySeverity {
  switch (probability?.toUpperCase()) {
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'low';
  }
}

const SECURITY_TYPES = new Set(['VULNERABILITY', 'SECURITY_HOTSPOT']);

function isSecurityRelevant(issue: SonarIssue): boolean {
  if (issue.type && SECURITY_TYPES.has(issue.type.toUpperCase())) return true;
  if (issue.impacts?.some((i) => i.softwareQuality?.toUpperCase() === 'SECURITY')) return true;
  return (issue.tags ?? []).some((t) => /^(cwe|owasp|sans-top25|security)/i.test(t));
}

function tagsOf(tags: string[] | undefined): { cwe: string[]; owasp: string[] } {
  const cwe: string[] = [];
  const owasp: string[] = [];
  for (const tag of tags ?? []) {
    const cweMatch = /^cwe-?(\d+)$/i.exec(tag);
    if (cweMatch) {
      cwe.push('CWE-' + cweMatch[1]);
      continue;
    }
    if (/^owasp/i.test(tag)) owasp.push(tag);
  }
  return { cwe, owasp };
}

export function parseSonarIssues(
  issues: SonarIssue[],
  hotspots: SonarHotspot[],
  serverUrl?: string,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const base = serverUrl?.replace(/\/$/, '') ?? null;
  let counter = 0;

  for (const issue of issues) {
    if (!isSecurityRelevant(issue)) continue;
    counter += 1;
    const { cwe, owasp } = tagsOf(issue.tags);
    const rule = issue.rule ?? 'sonar';
    const security = issue.impacts?.find((i) => i.softwareQuality?.toUpperCase() === 'SECURITY');
    findings.push({
      id: 'sonarqube-' + counter,
      scannerId: 'sonarqube',
      ruleId: rule,
      title: issue.message?.split('\n')[0] ?? rule,
      detail: issue.message ?? '',
      severity: issueSeverity(issue),
      nativeSeverity: security?.severity ?? issue.severity ?? null,
      kind: 'sast',
      file: sonarComponentToFile(issue.component),
      line: issue.line ?? null,
      endLine: null,
      // The issues API does not return source, and fetching every snippet would be a request per
      // finding. The file and line is enough for an agent to go look.
      excerpt: null,
      cwe,
      owasp,
      cve: null,
      packageName: null,
      installedVersion: null,
      fixedVersion: null,
      helpUri: base ? base + '/coding_rules?open=' + encodeURIComponent(rule) : null,
      remediation: null,
      redacted: false,
    });
  }

  for (const hotspot of hotspots) {
    counter += 1;
    const rule = hotspot.ruleKey ?? 'sonar-hotspot';
    findings.push({
      id: 'sonarqube-' + counter,
      scannerId: 'sonarqube',
      ruleId: rule,
      title: hotspot.message?.split('\n')[0] ?? rule,
      detail:
        (hotspot.message ?? '') +
        (hotspot.securityCategory ? '\n\nCategory: ' + hotspot.securityCategory : ''),
      severity: hotspotSeverity(hotspot.vulnerabilityProbability),
      nativeSeverity: hotspot.vulnerabilityProbability ?? null,
      kind: 'hotspot',
      file: sonarComponentToFile(hotspot.component),
      line: hotspot.line ?? null,
      endLine: null,
      excerpt: null,
      cwe: [],
      owasp: [],
      cve: null,
      packageName: null,
      installedVersion: null,
      fixedVersion: null,
      helpUri: base && hotspot.key ? base + '/security_hotspots?hotspots=' + hotspot.key : null,
      remediation: 'Sonar flags this as worth a human review rather than a confirmed bug.',
      redacted: false,
    });
  }

  return findings;
}
