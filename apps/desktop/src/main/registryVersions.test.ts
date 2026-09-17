import { describe, expect, it } from 'vitest';
import { compareVersions, releaseUrl } from './registryVersions';

describe('compareVersions', () => {
  it('treats a higher segment as newer', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBeGreaterThan(0);
  });

  it('treats an equal version as equal', () => {
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('treats a lower segment as older', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
  });
});

describe('releaseUrl', () => {
  it('links to the npm package page', () => {
    expect(releaseUrl({ type: 'npm', package: '@anthropic-ai/claude-code' })).toBe(
      'https://www.npmjs.com/package/@anthropic-ai/claude-code',
    );
  });

  it('links to the PyPI project page', () => {
    expect(releaseUrl({ type: 'pypi', package: 'aider-chat' })).toBe(
      'https://pypi.org/project/aider-chat/',
    );
  });

  it('links to the latest GitHub release', () => {
    expect(releaseUrl({ type: 'github-release', package: 'owner/repo' })).toBe(
      'https://github.com/owner/repo/releases/latest',
    );
  });
});
