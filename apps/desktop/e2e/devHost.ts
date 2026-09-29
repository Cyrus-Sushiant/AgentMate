import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { APP_ROOT } from './paths';

/**
 * The server core's DevHost for e2e runs: the real core on loopback TCP, so the Deploy page can
 * be driven end to end on machines without Linux or systemd. Built once per run with the SDK the
 * repo pins, then started straight from its DLL so stopping it leaves nothing behind.
 */

const PROJECT = join(APP_ROOT, '..', 'server-core', 'src', 'AgentMate.ServerCore.DevHost');
const DLL = join(PROJECT, 'bin', 'Debug', 'net10.0', 'AgentMate.ServerCore.DevHost.dll');
const READY_TIMEOUT_MS = 60_000;

export interface DevHost {
  port: number;
  stop: () => void;
}

export function dotnetAvailable(): boolean {
  try {
    execFileSync('dotnet', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });
}

/** The same request the app makes: health, with the Host header the core allows. */
function healthy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const call = request(
      { host: '127.0.0.1', port, path: '/api/v1/health', headers: { host: 'agentmate-core' } },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    call.once('error', () => resolve(false));
    call.setTimeout(2_000, () => call.destroy());
    call.end();
  });
}

export async function startDevHost(): Promise<DevHost> {
  execFileSync('dotnet', ['build', PROJECT, '--nologo', '-v', 'quiet'], { stdio: 'inherit' });
  const port = await freePort();
  const child: ChildProcess = spawn('dotnet', [DLL], {
    env: { ...process.env, AGENTMATE_DEV_CORE_PORT: String(port) },
    stdio: 'ignore',
  });
  const stop = () => {
    if (child.exitCode === null) child.kill();
  };
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`The DevHost exited with code ${child.exitCode}.`);
    if (await healthy(port)) return { port, stop };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  stop();
  throw new Error(`The DevHost did not answer on port ${port} within a minute.`);
}
