/**
 * What a project's run command starts, read from the command itself and from what it prints.
 * The status bar uses this to show where a run can be reached: a web address, or the emulator
 * or phone a mobile app was installed on.
 */

export type RunKind = 'web' | 'mobile' | 'other';

const MOBILE_COMMAND =
  /\bflutter\s+run\b|\bexpo\s+(?:start|run:android|run:ios)\b|\breact-native\s+run-(?:android|ios)\b|\b(?:cap|capacitor)\s+run\b|\bgradlew(?:\.bat)?\b.*\binstall|\bxcodebuild\b|\btauri\s+(?:android|ios)\b/i;

const WEB_COMMAND =
  /\b(?:dev|serve|start|preview|watch|vite|next|nuxt|astro|remix|webpack|runserver|uvicorn|gunicorn|http-server|live-server)\b|\brails\s+s(?:erver)?\b|\bflask\s+run\b|\bdotnet\s+run\b/i;

/** A guess from the command alone. Output can still show a run is mobile (see `parseRunDevices`). */
export function classifyRunCommand(command: string): RunKind {
  if (MOBILE_COMMAND.test(command)) return 'mobile';
  if (WEB_COMMAND.test(command)) return 'web';
  return 'other';
}

const DEVICE_PATTERNS: RegExp[] = [
  // Flutter: "Launching lib/main.dart on sdk gphone64 x86 64 in debug mode..."
  /Launching \S+ on (.+?) in (?:debug|profile|release) mode/g,
  // Gradle (and React Native, which runs it): "Installing APK 'app-debug.apk' on 'Pixel_7(AVD) - 14'"
  /Installing APK '[^']+' on '([^']+)'/g,
  // React Native: 'Installing the app on the device "emulator-5554"'
  /Installing the app on the device "([^"]+)"/g,
  // Expo: "› Opening exp://192.168.1.5:8081 on Pixel_7_API_34"
  /Opening \S+ on ([^\r\n]+)/g,
  // A bare adb serial anywhere, as in "flutter run -d emulator-5554" echoed back.
  /\b(emulator-\d{4,5})\b/g,
];

function cleanDevice(raw: string): string {
  return raw
    .replace(/\(AVD\)/i, '')
    .replace(/\s+-\s+[\d.]+$/, '')
    .replace(/\.{3}$/, '')
    .trim();
}

/**
 * The devices a run says it is installing on or launching on, in the order they appear.
 * `text` must already be free of terminal escape codes.
 */
export function parseRunDevices(text: string): string[] {
  const found: { at: number; name: string }[] = [];
  for (const pattern of DEVICE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const name = cleanDevice(match[1] ?? '');
      if (name) found.push({ at: match.index ?? 0, name });
    }
  }
  found.sort((a, b) => a.at - b.at);
  return [...new Set(found.map((entry) => entry.name))];
}
