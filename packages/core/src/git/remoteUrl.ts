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

/**
 * v1 clone scope: public GitHub repos only. Accepts the forms users paste
 * (https URL with or without .git, bare host/owner/repo, scp-style
 * git@github.com:owner/repo, ssh://git@github.com/owner/repo), and rejects
 * local paths, file:// URLs and non-GitHub hosts so Add Project never clones
 * from an unexpected place. Returns null when the address is not clonable.
 */
export function normalizeCloneUrl(address: string): string | null {
  const raw = stripRemoteCredentials(address.trim().replace(/\.git$/i, ''));
  if (!raw || /\s/.test(raw)) return null;
  if (/^([a-z]:[\\/]|\\\\|\/|\.{1,2}[\\/]|file:)/i.test(raw)) return null;

  // scp-style: git@github.com:owner/repo (optionally user@host)
  const scp = /^[^@\s/]+@([^:\s/]+):(.+)$/.exec(raw);
  if (scp) {
    if (scp[1].toLowerCase() !== 'github.com') return null;
    const path = scp[2].replace(/^\/+|\/+$/g, '');
    if (!/^[^/]+\/[^/]+(\/[^/]+)*$/.test(path)) return null;
    return `https://github.com/${path}`;
  }

  const ssh = /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(raw);
  if (ssh) {
    if (ssh[1].toLowerCase() !== 'github.com') return null;
    const path = ssh[2].replace(/^\/+|\/+$/g, '');
    if (!/^[^/]+\/[^/]+(\/[^/]+)*$/.test(path)) return null;
    return `https://github.com/${path}`;
  }

  let path: string;
  const https = /^(https?:\/\/)([^/]+)\/(.+)$/i.exec(raw);
  if (https) {
    if (https[2].toLowerCase() !== 'github.com') return null;
    path = https[3];
  } else {
    // bare host/owner/repo copied from the address bar
    const bare = /^github\.com\/(.+)$/i.exec(raw);
    if (!bare) return null;
    path = bare[1];
  }
  path = path.replace(/^\/+|\/+$/g, '');
  if (!/^[^/]+\/[^/]+(\/[^/]+)*$/.test(path)) return null;
  return `https://github.com/${path}`;
}

/** True when Add Project can auto-clone the address in v1. */
export function isClonableGithubUrl(address: string): boolean {
  return normalizeCloneUrl(address) !== null;
}
