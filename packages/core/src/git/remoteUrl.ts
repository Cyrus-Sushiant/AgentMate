/**
 * The same address with any embedded userinfo removed.
 *
 * A remote cloned with a token is stored verbatim as
 * `https://user:ghp_xxx@github.com/org/repo.git`, so anywhere that address is
 * shown, saved or opened in a browser would carry the token with it. The
 * scp-style `git@host:owner/repo` form has no password field, so it is left alone.
 */
export function stripRemoteCredentials(address: string): string {
  const url = address.trim();
  const match = /^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@(.*)$/i.exec(url);
  return match ? `${match[1]}${match[2]}` : url;
}

/**
 * Turns any way of writing a repository address into a link a browser can open,
 * which is all a project's stored `repoUrl` is ever used for.
 *
 * Handles the three forms people arrive with: an ssh remote (`ssh://git@host/owner/repo`
 * or the scp-style `git@host:owner/repo.git`), a full http(s) URL, and a bare
 * `host/owner/repo` someone copied out of the address bar. The trailing `.git` goes
 * either way, and an address in some other scheme is left exactly as it was typed.
 * Credentials embedded in the remote never survive into the link.
 */
export function browsableRepoUrl(address: string): string {
  const url = stripRemoteCredentials(address.trim().replace(/\.git$/i, ''));
  if (!url) return '';

  const ssh = /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(url);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;

  // scp-style, e.g. git@github.com:me/my-app
  const scp = /^[^@\s/]+@([^:\s/]+):(.+)$/.exec(url);
  if (scp) return `https://${scp[1]}/${scp[2]}`;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  return `https://${url}`;
}
