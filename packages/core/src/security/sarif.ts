import { fromSarifLevel, fromSecuritySeverityScore, fromTrivySeverity } from './severity.js';
import type {
  SecurityFinding,
  SecurityFindingKind,
  SecurityScannerId,
  SecuritySeverity,
} from './types.js';

/**
 * One SARIF 2.1.0 reader for Semgrep, Trivy, Bearer and CodeQL.
 *
 * They all emit valid SARIF, but they populate different corners of it, and the differences are
 * not cosmetic:
 *  - CodeQL puts its real severity in a numeric `security-severity` property and stamps almost
 *    every result `level: "warning"`, and it hides rule metadata under `tool.extensions[]`
 *    rather than `tool.driver`.
 *  - Trivy hides the severity word in the last rule tag and packs the package, CVE and fixed
 *    version into the message prose.
 *  - Bearer emits container-absolute paths when it runs dockerized, and SARIF has no "critical"
 *    level, so its critical findings arrive indistinguishable from high.
 *  - Semgrep uses dotted rule ids and reports `# nosemgrep` as a suppression rather than by
 *    omitting the result.
 *
 * All of that is handled here rather than in four near-identical parsers. The parser never
 * throws: anything unreadable is skipped and reported through `warnings`.
 */

interface SarifRegion {
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  snippet?: { text?: string };
}

interface SarifPhysicalLocation {
  artifactLocation?: { uri?: string; uriBaseId?: string };
  region?: SarifRegion;
  contextRegion?: SarifRegion;
}

interface SarifLocation {
  physicalLocation?: SarifPhysicalLocation;
  message?: { text?: string };
}

interface SarifRule {
  id?: string;
  name?: string;
  shortDescription?: { text?: string };
  fullDescription?: { text?: string };
  help?: { text?: string; markdown?: string };
  helpUri?: string;
  defaultConfiguration?: { level?: string };
  properties?: {
    tags?: string[];
    'security-severity'?: string | number;
    'problem.severity'?: string;
    precision?: string;
    [key: string]: unknown;
  };
}

interface SarifToolComponent {
  name?: string;
  version?: string;
  semanticVersion?: string;
  rules?: SarifRule[];
}

interface SarifResult {
  ruleId?: string;
  ruleIndex?: number;
  rule?: { id?: string; index?: number; toolComponent?: { index?: number } };
  level?: string;
  kind?: string;
  message?: { text?: string; markdown?: string };
  locations?: SarifLocation[];
  suppressions?: unknown[];
  partialFingerprints?: Record<string, string>;
  properties?: Record<string, unknown>;
}

interface SarifRun {
  tool?: { driver?: SarifToolComponent; extensions?: SarifToolComponent[] };
  results?: SarifResult[];
  originalUriBaseIds?: Record<string, { uri?: string; uriBaseId?: string }>;
  invocations?: { executionSuccessful?: boolean }[];
}

interface SarifLog {
  runs?: SarifRun[];
}

export interface ParseSarifOptions {
  scannerId: SecurityScannerId;
  /** Absolute project root on the host, used to relativize absolute artifact URIs. */
  projectPath?: string;
  /** Mount point inside the container when the tool ran dockerized, e.g. '/tmp/scan'. */
  containerRoot?: string;
  /** Stop after this many findings, so one noisy scanner cannot swamp the report. */
  maxFindings?: number;
  /** Info-level findings are dropped unless this is on. */
  includeInfo?: boolean;
  fallbackSeverity?: SecuritySeverity;
}

export interface ParseSarifOutcome {
  findings: SecurityFinding[];
  truncated: boolean;
  warnings: string[];
  toolVersion: string | null;
}

const CWE_TAG = /^(?:external\/cwe\/)?cwe[-_/]?(\d+)\b/i;
/** Captures just the code, so a badge reads "A01:2021" not a whole category sentence. */
const OWASP_TAG = /^(?:external\/)?owasp[-_/:\s]*([AaMm]\d{1,2}[:-]?\d{0,4})\b/i;
const TRIVY_SEVERITY_TAG = /^(CRITICAL|HIGH|MEDIUM|LOW|UNKNOWN)$/;
const CVE_ID = /^(CVE-\d{4}-\d+|GHSA-[\w-]+)$/i;

/** SARIF result kinds that are not findings at all. */
const NON_FINDING_KINDS = new Set(['pass', 'notapplicable', 'informational', 'open']);

function stripScheme(uri: string): string {
  let path = uri.replace(/^file:\/\/\/?/i, '');
  // A Windows URI decodes to /E:/proj/... and the leading slash has to go.
  if (/^\/[a-z]:\//i.test(path)) path = path.slice(1);
  return path;
}

function safeDecode(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    // A malformed percent-escape is not worth losing the finding over.
    return uri;
  }
}

/**
 * Resolve `uriBaseId` indirection. CodeQL reports paths relative to %SRCROOT%, and the base can
 * itself chain to another base, so this follows the chain with a depth guard.
 */
function resolveUriBase(baseId: string | undefined, bases: SarifRun['originalUriBaseIds']): string {
  let current = baseId;
  let prefix = '';
  for (let depth = 0; current && bases && depth < 8; depth += 1) {
    const entry = bases[current];
    if (!entry?.uri) break;
    prefix = stripScheme(safeDecode(entry.uri)).replace(/\/$/, '') + '/' + prefix;
    current = entry.uriBaseId;
  }
  return prefix;
}

/**
 * SARIF URIs arrive as POSIX relatives, absolute container paths, Windows paths with either
 * separator, or base-id relatives. Everything is normalized to a project-relative POSIX path so a
 * finding's file and line is something the user (and an agent) can actually open.
 */
export function normalizeArtifactUri(
  uri: string | undefined,
  opts: ParseSarifOptions,
  baseId?: string,
  bases?: SarifRun['originalUriBaseIds'],
): { file: string | null; warning: string | null } {
  if (!uri) return { file: null, warning: null };

  let path = resolveUriBase(baseId, bases) + stripScheme(safeDecode(uri));
  path = path.replace(/\\/g, '/');

  if (opts.containerRoot) {
    const root = opts.containerRoot.replace(/\\/g, '/').replace(/\/$/, '');
    if (path === root) return { file: null, warning: null };
    if (path.startsWith(root + '/')) path = path.slice(root.length + 1);
  }

  if (opts.projectPath) {
    const root = opts.projectPath.replace(/\\/g, '/').replace(/\/$/, '');
    // Windows paths differ only by drive-letter case often enough to be worth ignoring.
    if (path.toLowerCase().startsWith(root.toLowerCase() + '/')) path = path.slice(root.length + 1);
  }

  path = path
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '');

  // A path that still escapes the project after normalization is either a tool quirk or a crafted
  // SARIF. Keep the finding, but do not hand the UI something that resolves outside the project.
  if (path.includes('../') || /^[a-z]:\//i.test(path)) {
    const base = path.split('/').pop() ?? path;
    return {
      file: base || null,
      warning: 'Path outside the project was reduced to a file name: ' + path,
    };
  }

  return { file: path || null, warning: null };
}

function collectTags(rule: SarifRule | undefined): {
  cwe: string[];
  owasp: string[];
  trivySeverity: string | null;
  kindHint: SecurityFindingKind | null;
} {
  const cwe: string[] = [];
  const owasp: string[] = [];
  let trivySeverity: string | null = null;
  let kindHint: SecurityFindingKind | null = null;

  for (const tag of rule?.properties?.tags ?? []) {
    const cweMatch = CWE_TAG.exec(tag);
    if (cweMatch) {
      const id = 'CWE-' + cweMatch[1];
      if (!cwe.includes(id)) cwe.push(id);
      continue;
    }
    // Trivy stamps the real severity word in as a plain tag, which is the only place it appears.
    if (TRIVY_SEVERITY_TAG.test(tag)) {
      trivySeverity = tag;
      continue;
    }
    if (/^vulnerability$/i.test(tag)) kindHint = 'dependency';
    else if (/^secret$/i.test(tag)) kindHint = 'secret';
    else if (/^(misconfiguration|config)$/i.test(tag)) kindHint = 'misconfig';

    const owaspMatch = OWASP_TAG.exec(tag);
    if (owaspMatch) {
      const id = owaspMatch[1].trim();
      if (id && !owasp.includes(id)) owasp.push(id);
    }
  }
  return { cwe, owasp, trivySeverity, kindHint };
}

/**
 * Trivy writes its structured data as labelled prose lines rather than SARIF properties, so this
 * scrapes them back out. The format is not contractual: a missing label leaves the field null
 * rather than failing the finding.
 */
export function scrapeTrivyMessage(message: string): {
  packageName: string | null;
  installedVersion: string | null;
  fixedVersion: string | null;
  link: string | null;
} {
  const read = (label: string): string | null => {
    const match = new RegExp('^\\s*' + label + ':\\s*(.+)$', 'im').exec(message);
    return match ? match[1].trim() : null;
  };
  const linkRaw = read('Link');
  const linkUrl = linkRaw ? (/\((https?:\/\/[^)]+)\)/.exec(linkRaw)?.[1] ?? linkRaw) : null;
  return {
    packageName: read('Package'),
    installedVersion: read('Installed Version'),
    fixedVersion: read('Fixed Version'),
    link: linkUrl,
  };
}

/** Prefer the shortest text that still says something, so cards stay readable. */
function pickTitle(result: SarifResult, rule: SarifRule | undefined, ruleId: string): string {
  const short = rule?.shortDescription?.text?.trim();
  // Semgrep sets shortDescription to "Semgrep Finding: <the rule id>", which says nothing
  // the rule id does not already say. A description that just restates the id is skipped,
  // so the result message (an actual sentence about the problem) wins instead.
  if (short && !short.includes(ruleId)) return truncate(short.split('\n')[0], 160);
  const message = result.message?.text?.trim();
  if (message) return truncate(firstSentence(message), 160);
  const name = rule?.name?.trim();
  if (name) return truncate(name, 160);
  // Semgrep rule ids are long dotted paths; the last segment is the readable part.
  return ruleId.includes('.') ? (ruleId.split('.').pop() ?? ruleId) : ruleId;
}

/**
 * A rule message is usually a short paragraph: the problem, then the advice. The first sentence
 * is the part worth putting on a card headline; the rest stays in the detail below it.
 */
function firstSentence(text: string): string {
  const line = text.split('\n')[0].trim();
  const stop = /[.!?](?:\s|$)/.exec(line);
  return stop && stop.index > 20 ? line.slice(0, stop.index + 1) : line;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + '...' : text;
}

/**
 * Trivy repeats itself. Its message is a block of "Label: value" lines that this parser has
 * already lifted into packageName / installedVersion / fixedVersion / helpUri, and its rule help
 * opens with a markdown table saying the same thing again. Both are pure noise once the report
 * renders those as structured fields, and in a copied fix prompt they are noise the model pays
 * for, so they get stripped and only the real prose is kept.
 */
function stripTrivyBoilerplate(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^\|/.test(trimmed)) return false;
      // The bare "Vulnerability CVE-1234-5678" line carries no colon, and the id is already
      // its own field, so it is dropped too.
      if (/^(\*\*)?Vulnerability\s+(CVE|GHSA|AVD)/i.test(trimmed)) return false;
      return !/^(Package|Installed Version|Vulnerability|Severity|Fixed Version|Link|Title|PkgName|VulnerabilityID):/i.test(
        trimmed,
      );
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function pickDetail(
  result: SarifResult,
  rule: SarifRule | undefined,
  scannerId: SecurityScannerId,
): string {
  const message = result.message?.text?.trim();
  const full = rule?.fullDescription?.text?.trim();
  // Semgrep repeats the rule description in the message, so avoid printing it twice.
  const chosen = message && full && full.startsWith(message) ? full : message || full || '';
  return truncate(scannerId === 'trivy' ? stripTrivyBoilerplate(chosen) : chosen, 4000);
}

function pickRemediation(rule: SarifRule | undefined, scannerId: SecurityScannerId): string | null {
  // CodeQL's help is a full explainer and is the single most useful text in the whole report,
  // so it gets a generous budget rather than a one-line clip.
  const help = rule?.help?.markdown?.trim() || rule?.help?.text?.trim();
  if (!help) return null;
  const cleaned = scannerId === 'trivy' ? stripTrivyBoilerplate(help) : help;
  return cleaned ? truncate(cleaned, 4000) : null;
}

export function parseSarif(raw: unknown, opts: ParseSarifOptions): ParseSarifOutcome {
  const warnings: string[] = [];
  const log = raw as SarifLog | null;
  if (!log || typeof log !== 'object' || !Array.isArray(log.runs)) {
    return {
      findings: [],
      truncated: false,
      warnings: ['No SARIF runs in the output.'],
      toolVersion: null,
    };
  }

  const max = opts.maxFindings ?? 2000;
  const findings: SecurityFinding[] = [];
  let truncated = false;
  let toolVersion: string | null = null;
  let counter = 0;

  for (const run of log.runs) {
    const driver = run.tool?.driver;
    toolVersion ??= driver?.semanticVersion ?? driver?.version ?? null;

    if (run.invocations?.some((i) => i.executionSuccessful === false)) {
      warnings.push('The tool reported a partial run, so some files may not have been analyzed.');
    }

    // CodeQL query packs put their rule metadata under tool.extensions rather than tool.driver.
    // Missing this is why CodeQL findings so often show up with no description anywhere.
    const components: SarifToolComponent[] = [driver ?? {}, ...(run.tool?.extensions ?? [])];
    const rulesById = new Map<string, SarifRule>();
    for (const component of components) {
      for (const rule of component.rules ?? []) if (rule.id) rulesById.set(rule.id, rule);
    }

    for (const result of run.results ?? []) {
      if (result.kind && NON_FINDING_KINDS.has(result.kind.toLowerCase())) continue;
      // A suppression is the tool telling us the user already dismissed this (# nosemgrep etc).
      if (Array.isArray(result.suppressions) && result.suppressions.length > 0) continue;

      if (findings.length >= max) {
        truncated = true;
        break;
      }

      // Rule resolution, most specific first: an explicit component-scoped index, then the
      // driver-scoped index, then the id map.
      const componentIndex = result.rule?.toolComponent?.index;
      const scopedRules =
        typeof componentIndex === 'number' ? components[componentIndex]?.rules : driver?.rules;
      const byRuleIndex =
        typeof result.rule?.index === 'number' ? scopedRules?.[result.rule.index] : undefined;
      const byResultIndex =
        typeof result.ruleIndex === 'number' ? driver?.rules?.[result.ruleIndex] : undefined;
      const ruleId = result.ruleId ?? result.rule?.id ?? '';
      const rule = byRuleIndex ?? byResultIndex ?? (ruleId ? rulesById.get(ruleId) : undefined);
      const effectiveRuleId = ruleId || rule?.id || rule?.name || driver?.name || 'unknown';

      const physical = result.locations?.[0]?.physicalLocation;
      const region = physical?.region;
      const { file, warning } = normalizeArtifactUri(
        physical?.artifactLocation?.uri,
        opts,
        physical?.artifactLocation?.uriBaseId,
        run.originalUriBaseIds,
      );
      if (warning) warnings.push(warning);

      const tags = collectTags(rule);

      // Precedence is deliberate: a numeric score is the only signal CodeQL gives, and Trivy's
      // tag word is the only signal it gives. SARIF `level` is the weakest of the three because
      // CodeQL stamps nearly everything "warning".
      const scored = fromSecuritySeverityScore(rule?.properties?.['security-severity']);
      const severity: SecuritySeverity =
        scored ??
        (tags.trivySeverity
          ? fromTrivySeverity(tags.trivySeverity)
          : result.level
            ? fromSarifLevel(result.level)
            : rule?.defaultConfiguration?.level
              ? fromSarifLevel(rule.defaultConfiguration.level)
              : (opts.fallbackSeverity ?? 'medium'));

      if (severity === 'info' && !opts.includeInfo) continue;

      const messageText = result.message?.text ?? '';
      const trivyBits = opts.scannerId === 'trivy' ? scrapeTrivyMessage(messageText) : null;
      const snippet = region?.snippet?.text ?? physical?.contextRegion?.snippet?.text ?? null;

      const kind: SecurityFindingKind =
        tags.kindHint ??
        (opts.scannerId === 'trivy' ? 'dependency' : opts.scannerId === 'strix' ? 'dast' : 'sast');

      counter += 1;
      findings.push({
        id: opts.scannerId + '-' + counter,
        scannerId: opts.scannerId,
        ruleId: effectiveRuleId,
        title: pickTitle(result, rule, effectiveRuleId),
        detail: pickDetail(result, rule, opts.scannerId),
        severity,
        nativeSeverity:
          tags.trivySeverity ?? result.level ?? rule?.defaultConfiguration?.level ?? null,
        kind,
        file,
        line: region?.startLine ?? null,
        endLine: region?.endLine ?? null,
        // Trailing \r on a CRLF checkout would otherwise show up in every excerpt.
        excerpt: snippet ? snippet.replace(/\s+$/, '') : null,
        cwe: tags.cwe,
        owasp: tags.owasp,
        cve: CVE_ID.test(effectiveRuleId) ? effectiveRuleId.toUpperCase() : null,
        packageName: trivyBits?.packageName ?? null,
        installedVersion: trivyBits?.installedVersion ?? null,
        fixedVersion: trivyBits?.fixedVersion ?? null,
        helpUri: rule?.helpUri ?? trivyBits?.link ?? null,
        remediation: pickRemediation(rule, opts.scannerId),
        redacted: false,
      });
    }
    if (truncated) break;
  }

  return { findings, truncated, warnings, toolVersion };
}
