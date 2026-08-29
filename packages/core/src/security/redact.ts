import type { SecurityFinding } from './types.js';

/**
 * Secret scanners put the matched credential straight into the finding text. This report has a
 * "copy for AI" button, so leaving it there would turn a security feature into an exfiltration
 * path: one click and a live AWS key is in a chat window.
 *
 * So secrets are masked in the main process before findings ever cross IPC. The rule, the file
 * and the line all survive, which is everything needed to go fix it. There is deliberately no
 * "reveal" button; the user can open the file.
 */

/** Long runs of credential-shaped characters, plus the common prefixed key formats. */
const SECRET_PATTERNS: RegExp[] = [
  // Vendor-prefixed keys, which are the ones worth catching precisely.
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  // JWTs.
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  // PEM private key bodies.
  /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
  // A generic long high-entropy-looking run, last so the specific ones win first.
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

function maskValue(value: string): string {
  // Keep the length hint: knowing it was a 40-character token helps identify which secret it was
  // without disclosing any of it.
  return '[redacted ' + value.length + ' chars]';
}

export function maskSecrets(text: string): { text: string; changed: boolean } {
  let output = text;
  let changed = false;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match) => {
      changed = true;
      return maskValue(match);
    });
  }
  return { text: output, changed };
}

/**
 * Mask a known literal secret (an API key we hold in settings) wherever it appears. Used on tool
 * logs, since a scanner can echo its own environment on failure.
 */
export function maskKnownSecrets(text: string, secrets: (string | null | undefined)[]): string {
  let output = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 8) continue;
    output = output.split(secret).join('[redacted]');
  }
  return output;
}

/**
 * Redact any finding that could carry a live credential. Secret-kind findings are always scrubbed;
 * every other finding still gets a pass over its excerpt, because a SAST rule that fires on a
 * hardcoded token will happily quote the token in its snippet.
 */
export function redactSecretFindings(findings: SecurityFinding[]): SecurityFinding[] {
  return findings.map((finding) => {
    const isSecret = finding.kind === 'secret';
    const detail = maskSecrets(finding.detail);
    const excerpt = finding.excerpt ? maskSecrets(finding.excerpt) : null;
    const title = isSecret ? maskSecrets(finding.title) : { text: finding.title, changed: false };

    const changed = detail.changed || (excerpt?.changed ?? false) || title.changed;
    if (!changed) return finding;

    return {
      ...finding,
      title: title.text,
      detail: detail.text,
      excerpt: excerpt ? excerpt.text : null,
      redacted: true,
    };
  });
}
