/**
 * Turns any way of writing a repository address into a link a browser can open,
 * which is all a project's stored `repoUrl` is ever used for.
 *
 * Handles the three forms people arrive with: an ssh remote (`ssh://git@host/owner/repo`
 * or the scp-style `git@host:owner/repo.git`), a full http(s) URL, and a bare
 * `host/owner/repo` someone copied out of the address bar. The trailing `.git` goes
 * either way, and an address in some other scheme is left exactly as it was typed.
 */
export function browsableRepoUrl(address: string): string {
  const url = address.trim().replace(/\.git$/i, '');
  if (!url) return '';

  const ssh = /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(url);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;

  // scp-style, e.g. git@github.com:me/my-app
  const scp = /^[^@\s/]+@([^:\s/]+):(.+)$/.exec(url);
  if (scp) return `https://${scp[1]}/${scp[2]}`;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  return `https://${url}`;
}
