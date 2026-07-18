import { type ChildProcessByStdio, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import { app, screen } from 'electron';
import type { RemoteInputEvent } from '../../shared/remoteProtocol';

/**
 * Injects mouse/keyboard input into the host OS on behalf of a remote
 * controller.
 *
 * On Windows this drives a long-lived PowerShell helper that P/Invokes the
 * Win32 input APIs (`SetCursorPos`, `mouse_event`, `keybd_event`, `SendInput`).
 * Keeping one process alive and feeding it single-line commands over stdin
 * avoids the per-event cost of spawning PowerShell, which is what makes
 * real-time control feel responsive. No native npm module is required.
 *
 * On other platforms it is a no-op and reports itself unsupported — OS-level
 * input injection there needs a platform-specific tool we don't ship yet.
 */

const MOUSEEVENTF = {
  leftdown: 0x0002,
  leftup: 0x0004,
  rightdown: 0x0008,
  rightup: 0x0010,
  middledown: 0x0020,
  middleup: 0x0040,
  wheel: 0x0800,
  hwheel: 0x01000,
} as const;

// DOM KeyboardEvent.code -> Win32 virtual-key code, for the non-character keys
// that can't be reproduced by typing a Unicode character.
const VK_BY_CODE: Record<string, number> = {
  Enter: 0x0d,
  NumpadEnter: 0x0d,
  Tab: 0x09,
  Backspace: 0x08,
  Delete: 0x2e,
  Escape: 0x1b,
  ArrowLeft: 0x25,
  ArrowUp: 0x26,
  ArrowRight: 0x27,
  ArrowDown: 0x28,
  Home: 0x24,
  End: 0x23,
  PageUp: 0x21,
  PageDown: 0x22,
  Insert: 0x2d,
  ShiftLeft: 0xa0,
  ShiftRight: 0xa1,
  ControlLeft: 0xa2,
  ControlRight: 0xa3,
  AltLeft: 0xa4,
  AltRight: 0xa5,
  MetaLeft: 0x5b,
  MetaRight: 0x5c,
  CapsLock: 0x14,
  F1: 0x70,
  F2: 0x71,
  F3: 0x72,
  F4: 0x73,
  F5: 0x74,
  F6: 0x75,
  F7: 0x76,
  F8: 0x77,
  F9: 0x78,
  F10: 0x79,
  F11: 0x7a,
  F12: 0x7b,
};

// Extended keys need MOUSEEVENTF-style EXTENDEDKEY flag for correct behaviour.
const EXTENDED_CODES = new Set([
  'ArrowLeft',
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Insert',
  'Delete',
  'NumpadEnter',
  'ControlRight',
  'AltRight',
]);

const PS_HELPER = String.raw`
$ErrorActionPreference = 'Stop'
$src = @"
using System;
using System.Runtime.InteropServices;
public class AmInput {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint data, IntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint f, IntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; [FieldOffset(0)] public MOUSEINPUT mi; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion U; }
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
  public static void TypeChar(ushort c) {
    INPUT[] a = new INPUT[2];
    a[0].type = 1; a[0].U.ki = new KEYBDINPUT { wVk = 0, wScan = c, dwFlags = 0x0004, time = 0, dwExtraInfo = IntPtr.Zero };
    a[1].type = 1; a[1].U.ki = new KEYBDINPUT { wVk = 0, wScan = c, dwFlags = 0x0004 | 0x0002, time = 0, dwExtraInfo = IntPtr.Zero };
    SendInput(2, a, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@
Add-Type -TypeDefinition $src
[AmInput]::SetProcessDPIAware() | Out-Null
while (($line = [Console]::In.ReadLine()) -ne $null) {
  if ($line.Length -eq 0) { continue }
  $p = $line.Split(' ')
  try {
    switch ($p[0]) {
      'M' { [AmInput]::SetCursorPos([int]$p[1], [int]$p[2]) | Out-Null }
      'E' { [AmInput]::mouse_event([uint32]$p[1], 0, 0, [uint32]$p[2], [IntPtr]::Zero) }
      'K' { [AmInput]::keybd_event([byte][int]$p[1], 0, [uint32]$p[2], [IntPtr]::Zero) }
      'T' { [AmInput]::TypeChar([uint16][int]$p[1]) }
      'Q' { break }
    }
  } catch { }
}
`;

export class InputInjector {
  private proc: ChildProcessByStdio<Writable, null, null> | null = null;
  private scriptPath: string | null = null;
  private readonly supported = process.platform === 'win32';

  isSupported(): boolean {
    return this.supported;
  }

  start(): void {
    if (!this.supported || this.proc) return;
    this.scriptPath = join(app.getPath('userData'), 'remote-input-helper.ps1');
    writeFileSync(this.scriptPath, PS_HELPER, 'utf-8');
    this.proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
      { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true },
    );
    this.proc.on('exit', () => {
      this.proc = null;
    });
  }

  stop(): void {
    if (!this.proc) return;
    try {
      this.proc.stdin.write('Q\n');
      this.proc.stdin.end();
    } catch {
      // process may already be gone
    }
    this.proc.kill();
    this.proc = null;
  }

  apply(event: RemoteInputEvent): void {
    if (!this.proc) return;
    const cmds = this.toCommands(event);
    if (cmds.length === 0) return;
    try {
      this.proc.stdin.write(cmds.map((c) => c + '\n').join(''));
    } catch {
      // dropped keystroke on a dying helper — the next start() re-establishes it
    }
  }

  private toCommands(event: RemoteInputEvent): string[] {
    switch (event.k) {
      case 'move':
        return [`M ${this.px(event.x, 'w')} ${this.px(event.y, 'h')}`];
      case 'down':
      case 'up': {
        const flag = MOUSEEVENTF[`${event.button}${event.k === 'down' ? 'down' : 'up'}` as keyof typeof MOUSEEVENTF];
        // Move first so the click lands where the controller pointed.
        return [`M ${this.px(event.x, 'w')} ${this.px(event.y, 'h')}`, `E ${flag} 0`];
      }
      case 'wheel': {
        // One notch is WHEEL_DELTA (120); dy>0 (scroll down) should scroll the
        // page down, which is a negative wheel value in Win32.
        const delta = Math.round(-event.dy) * 120;
        const uDelta = delta < 0 ? delta + 0x100000000 : delta;
        return [`E ${MOUSEEVENTF.wheel} ${uDelta}`];
      }
      case 'key': {
        const vk = VK_BY_CODE[event.code];
        if (vk === undefined) return [];
        let flags = event.down ? 0 : 0x0002; // KEYEVENTF_KEYUP
        if (EXTENDED_CODES.has(event.code)) flags |= 0x0001; // KEYEVENTF_EXTENDEDKEY
        return [`K ${vk} ${flags}`];
      }
      case 'text': {
        const out: string[] = [];
        for (const ch of event.text) {
          const cp = ch.codePointAt(0);
          if (cp !== undefined && cp <= 0xffff) out.push(`T ${cp}`);
        }
        return out;
      }
      default:
        return [];
    }
  }

  private px(normalized: number, axis: 'w' | 'h'): number {
    const display = screen.getPrimaryDisplay();
    const size = axis === 'w' ? display.size.width : display.size.height;
    const physical = Math.round(size * display.scaleFactor);
    return Math.max(0, Math.min(physical - 1, Math.round(normalized * physical)));
  }
}
