import { describe, expect, it } from 'vitest';
import { classifyRunCommand, parseRunDevices } from './runTargets.js';

describe('classifyRunCommand', () => {
  it.each([
    'flutter run',
    'flutter run -d emulator-5554',
    'npx expo start',
    'npx expo run:android',
    'npx react-native run-android',
    'npx react-native run-ios --simulator "iPhone 15"',
    'npx cap run android',
    './gradlew installDebug',
    'gradlew.bat :app:installDebug',
    'xcodebuild -scheme App build',
  ])('reads %s as a mobile run', (command) => {
    expect(classifyRunCommand(command)).toBe('mobile');
  });

  it.each([
    'pnpm dev',
    'npm run start',
    'yarn serve',
    'npx vite',
    'next dev',
    'python manage.py runserver',
    'bin/rails s',
    'flask run --debug',
    'dotnet run',
    'uvicorn app.main:app --reload',
  ])('reads %s as a web run', (command) => {
    expect(classifyRunCommand(command)).toBe('web');
  });

  it.each(['cargo build', 'make', 'docker compose up'])('leaves %s unclassified', (command) => {
    expect(classifyRunCommand(command)).toBe('other');
  });

  it('ranks mobile above web, since mobile tools have dev-looking words too', () => {
    // `expo start` contains "start", which alone would read as a web server.
    expect(classifyRunCommand('npx expo start --dev-client')).toBe('mobile');
  });
});

describe('parseRunDevices', () => {
  it('reads the device Flutter launches on', () => {
    const output = 'Launching lib/main.dart on sdk gphone64 x86 64 in debug mode...\n';
    expect(parseRunDevices(output)).toEqual(['sdk gphone64 x86 64']);
  });

  it('reads the device Gradle installs on, without the AVD marker and Android version', () => {
    const output =
      "> Task :app:installDebug\nInstalling APK 'app-debug.apk' on 'Pixel_7_API_34(AVD) - 14' for :app:debug\nInstalled on 1 device.\n";
    expect(parseRunDevices(output)).toEqual(['Pixel_7_API_34']);
  });

  it('reads the device React Native installs on', () => {
    const output = 'info Installing the app on the device "emulator-5554"...\n';
    expect(parseRunDevices(output)).toEqual(['emulator-5554']);
  });

  it('reads the device Expo opens on', () => {
    const output = '› Opening exp://192.168.1.5:8081 on Pixel_7_API_34\n';
    expect(parseRunDevices(output)).toEqual(['Pixel_7_API_34']);
  });

  it('spots a bare adb serial', () => {
    expect(parseRunDevices('Using device emulator-5556\n')).toEqual(['emulator-5556']);
  });

  it('lists each device once, in the order they were printed', () => {
    const output = [
      'Launching lib/main.dart on Pixel 7 in debug mode...',
      'Syncing files to device emulator-5554...',
      'Launching lib/main.dart on Pixel 7 in debug mode...',
    ].join('\n');
    expect(parseRunDevices(output)).toEqual(['Pixel 7', 'emulator-5554']);
  });

  it('finds nothing in ordinary output', () => {
    const output = '  VITE v5.0.0  ready in 312 ms\n  ➜  Local:   http://localhost:5173/\n';
    expect(parseRunDevices(output)).toEqual([]);
    expect(parseRunDevices('')).toEqual([]);
  });
});
