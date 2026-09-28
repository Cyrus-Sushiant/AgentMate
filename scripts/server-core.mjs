#!/usr/bin/env node
/**
 * Runs the server core's .NET commands from `apps/server-core`, where its `global.json` pins the
 * SDK and the Microsoft.Testing.Platform runner. Running them from the repository root would pick
 * a different SDK and test runner, so the root scripts go through here.
 *
 *   node scripts/server-core.mjs build | test | format | format:check | contracts
 *
 * `contracts` regenerates the TypeScript types and typed hub client (Tapper and
 * TypedSignalR.Client.TypeScript) into the desktop's shared folder, from a clean slate so a C#
 * type that was removed cannot leave a stale file behind.
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreRoot = join(repoRoot, 'apps', 'server-core');
const solution = 'AgentMate.ServerCore.slnx';
const hostProject = join('src', 'AgentMate.ServerCore', 'AgentMate.ServerCore.csproj');
const contractsOutput = join(
  repoRoot,
  'apps',
  'desktop',
  'src',
  'shared',
  'deploy',
  'protocol',
  'generated',
);

function dotnet(args) {
  const result = spawnSync('dotnet', args, { cwd: coreRoot, stdio: 'inherit' });
  if (result.error) {
    console.error(`Could not run dotnet: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const commands = {
  build: () => dotnet(['build', solution]),
  test: () => dotnet(['test', '--project', join('tests', 'AgentMate.ServerCore.Tests')]),
  format: () => dotnet(['format', solution]),
  'format:check': () => dotnet(['format', solution, '--verify-no-changes']),
  contracts: () => {
    rmSync(contractsOutput, { recursive: true, force: true });
    dotnet(['tool', 'restore']);
    // The generator reads the project through MSBuild and only sees the attribute packages once
    // the project has been restored.
    dotnet(['restore', hostProject]);
    dotnet([
      'tsrts',
      '--project',
      hostProject,
      '--output',
      contractsOutput,
      '--enum',
      'UnionCamel',
      '--eol',
      'Lf',
    ]);
  },
};

const name = process.argv[2];
const command = name ? commands[name] : undefined;
if (!command) {
  console.error(`Usage: node scripts/server-core.mjs <${Object.keys(commands).join(' | ')}>`);
  process.exit(2);
}
command();
