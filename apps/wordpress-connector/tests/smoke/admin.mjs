/**
 * A logged-in wp-admin session for the smoke test: cookies kept by hand, redirects not followed.
 */

/** Signs in through wp-login.php. */
export async function login(base, user, password) {
  const jar = new Map([['wordpress_test_cookie', 'WP%20Cookie%20check']]);
  const keep = (response) => {
    for (const line of response.headers.getSetCookie()) {
      const pair = line.split(';')[0];
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
    }
  };
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  const send = async (path, init = {}) => {
    const response = await fetch(base + path, {
      ...init,
      headers: { ...(init.headers ?? {}), cookie: cookie() },
      redirect: 'manual',
    });
    keep(response);
    return {
      status: response.status,
      location: response.headers.get('location'),
      text: await response.text(),
    };
  };
  const signIn = await send('/wp-login.php', {
    method: 'POST',
    body: new URLSearchParams({ log: user, pwd: password, testcookie: '1', 'wp-submit': 'Log In' }),
  });
  if (signIn.status !== 302) throw new Error(`Could not sign in as ${user}: HTTP ${signIn.status}`);
  return {
    get: (path) => send(path),
    post: (path, fields) => send(path, { method: 'POST', body: new URLSearchParams(fields) }),
    upload: (path, form) => send(path, { method: 'POST', body: form }),
  };
}

/** The forms on a page, each with its hidden and named inputs. */
export function forms(html) {
  const out = [];
  for (const match of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    const fields = {};
    for (const input of match[1].matchAll(/<input\b[^>]*>/g)) {
      const name = input[0].match(/name="([^"]*)"/)?.[1];
      const value = input[0].match(/value="([^"]*)"/)?.[1] ?? '';
      if (name) fields[name] = value.replace(/&amp;/g, '&');
    }
    out.push(fields);
  }
  return out;
}
