import type { ActivityResource } from './types.js';

/** "23 min", "2 h" or "1 h 5 min". Rounds down; anything under a minute reads as such. */
export function formatIdleDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return 'under 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const MAX_NAMES = 3;

function noun(resources: ActivityResource[]): string {
  const docker = resources.filter((one) => one.kind === 'docker').length;
  const emulators = resources.length - docker;
  if (emulators === 0) return docker === 1 ? 'container' : 'containers';
  if (docker === 0) return emulators === 1 ? 'emulator' : 'emulators';
  return 'containers and emulators';
}

function nameList(names: string[]): string {
  const shown = names.slice(0, MAX_NAMES);
  const extra = names.length - shown.length;
  if (extra > 0) return `${shown.join(', ')} and ${extra} more`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

/** The desktop notification for resources that just crossed the idle threshold. */
export function describeIdleAlert(
  resources: ActivityResource[],
  idleMinutes: number,
): { title: string; body: string } {
  const count = resources.length;
  const single = count === 1;
  const title = `${count} idle ${noun(resources)}`;
  const names = nameList(resources.map((one) => one.name));
  const quiet = formatIdleDuration(idleMinutes * 60_000);
  const body = single
    ? `${names} has been idle for ${quiet}. Open the Dashboard to stop it.`
    : `${names} have been idle for ${quiet}. Open the Dashboard to stop them.`;
  return { title, body };
}
