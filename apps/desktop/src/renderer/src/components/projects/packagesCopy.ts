import type { PackageInfo, PackageManagerSection } from '@shared/apiTypes';

export type BumpKind = 'major' | 'minor' | 'patch';

function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const cleaned = version.trim().replace(/^[~^>=<\s]+/, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

export function bumpKind(current: string, latest: string): BumpKind | null {
  const from = parseSemver(current);
  const to = parseSemver(latest);
  if (!from || !to) return null;
  if (to.major !== from.major) return 'major';
  if (to.minor !== from.minor) return 'minor';
  if (to.patch !== from.patch) return 'patch';
  return null;
}

function managerName(section: PackageManagerSection): string {
  if (section.ecosystem === 'dotnet') return 'NuGet';
  return section.manager;
}

function installHint(section: PackageManagerSection): string {
  if (section.ecosystem === 'dotnet') {
    return 'dotnet add <project.csproj> package <Name> --version <version>';
  }
  if (section.manager === 'yarn') return 'yarn add <name>@<version> (add -D for dev dependencies)';
  if (section.manager === 'pnpm') return 'pnpm add <name>@<version> (add -D for dev dependencies)';
  return 'npm install <name>@<version> (add -D for dev dependencies)';
}

/** Unique names in display order, one per line. */
export function buildPackageNames(packages: PackageInfo[]): string {
  const names = [...new Set(packages.map((pkg) => pkg.name))].sort((a, b) => a.localeCompare(b));
  return names.join('\n');
}

/** A prompt an agent can act on to update the given packages to their latest versions. */
export function buildPackageUpdatePrompt(
  section: PackageManagerSection,
  packages: PackageInfo[],
): string {
  const manager = managerName(section);
  const byManifest = new Map<string, PackageInfo[]>();
  for (const pkg of packages) {
    const list = byManifest.get(pkg.manifestPath) ?? [];
    list.push(pkg);
    byManifest.set(pkg.manifestPath, list);
  }

  let majorCount = 0;
  const blocks: string[] = [];
  for (const [manifestPath, list] of [...byManifest.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const label = list[0]?.projectLabel;
    const heading = label ? `${label} (${manifestPath})` : manifestPath;
    const lines = [...list]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((pkg) => {
        const target = pkg.latestVersion ?? 'latest (version lookup failed, check the registry)';
        const bump = pkg.latestVersion ? bumpKind(pkg.currentVersion, pkg.latestVersion) : null;
        if (bump === 'major') majorCount += 1;
        const tags = [bump, pkg.isDev ? 'dev' : null].filter(Boolean).join(', ');
        return `- ${pkg.name}: ${pkg.currentVersion} -> ${target}${tags ? ` (${tags})` : ''}`;
      });
    blocks.push(`${heading}\n${lines.join('\n')}`);
  }

  const count = packages.length;
  const steps = [
    `Update each package with ${manager}, for example: ${installHint(section)}. Keep the existing version range style (^, ~, exact) in the manifest.`,
    majorCount > 0
      ? `${majorCount} of these ${majorCount === 1 ? 'is a major bump' : 'are major bumps'}. Before updating those, read the changelog or migration guide and fix any breaking changes in the code.`
      : null,
    'Only touch the packages listed here. If one package forces another to move (peer dependencies, shared versions), say so and explain why.',
    'After updating, run the typecheck, lint, tests, and build the project already uses, and fix anything that breaks.',
    'If a package cannot be updated cleanly, leave it at its current version and tell me what blocked it.',
  ].filter((step): step is string => step !== null);

  return [
    `Update ${count} outdated ${manager} package${count === 1 ? '' : 's'} in this project to their latest versions.`,
    '',
    'Packages (current -> latest):',
    '',
    blocks.join('\n\n'),
    '',
    'How to do it:',
    ...steps.map((step, i) => `${i + 1}. ${step}`),
    '',
    'When you are done, give me a short summary of what changed and anything that was left behind.',
  ].join('\n');
}
