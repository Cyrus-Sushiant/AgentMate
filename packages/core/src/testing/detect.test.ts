import { describe, expect, it } from 'vitest';
import { detectTestProjects, manifestPathsToRead } from './detect.js';

function detect(files: Record<string, string>, extra: string[] = []) {
  const paths = [...Object.keys(files), ...extra];
  return detectTestProjects({ files: paths, contents: files });
}

const ids = (files: Record<string, string>, extra: string[] = []) =>
  detect(files, extra).map((project) => project.id);

describe('manifestPathsToRead', () => {
  it('picks manifests and runner configs, skipping source files', () => {
    expect(
      manifestPathsToRead([
        'package.json',
        'src/index.ts',
        'apps/web/vitest.config.mts',
        'playwright.config.ts',
        'pyproject.toml',
        'tests/conftest.py',
        'requirements-dev.txt',
        'go.mod',
        'crates/a/Cargo.toml',
        'src/App.Tests/App.Tests.csproj',
        'pubspec.yaml',
        'composer.json',
        'phpunit.xml.dist',
        'Gemfile',
        '.rspec',
        'build.gradle.kts',
        'pom.xml',
        'README.md',
      ]),
    ).toEqual([
      'package.json',
      'apps/web/vitest.config.mts',
      'playwright.config.ts',
      'pyproject.toml',
      'tests/conftest.py',
      'requirements-dev.txt',
      'go.mod',
      'crates/a/Cargo.toml',
      'src/App.Tests/App.Tests.csproj',
      'pubspec.yaml',
      'composer.json',
      'phpunit.xml.dist',
      'Gemfile',
      '.rspec',
      'build.gradle.kts',
      'pom.xml',
    ]);
  });
});

describe('detectTestProjects', () => {
  it('finds Vitest from a dev dependency', () => {
    expect(detect({ 'package.json': '{"devDependencies":{"vitest":"^3.0.0"}}' })).toEqual([
      { id: 'vitest:', framework: 'vitest', root: '', label: 'Vitest' },
    ]);
  });

  it('finds Jest from a dependency, a config file, or a jest key', () => {
    expect(ids({ 'package.json': '{"devDependencies":{"jest":"29"}}' })).toEqual(['jest:']);
    expect(ids({ 'package.json': '{}', 'jest.config.js': '' })).toEqual(['jest:']);
    expect(ids({ 'package.json': '{"jest":{"testEnvironment":"node"}}' })).toEqual(['jest:']);
  });

  it('does not take a jest plugin for Jest itself', () => {
    expect(ids({ 'package.json': '{"devDependencies":{"eslint-plugin-jest":"1"}}' })).toEqual([]);
  });

  it('finds Playwright and Mocha', () => {
    expect(ids({ 'package.json': '{"devDependencies":{"@playwright/test":"1"}}' })).toEqual([
      'playwright:',
    ]);
    expect(ids({ 'package.json': '{"devDependencies":{"mocha":"10"}}' })).toEqual(['mocha:']);
  });

  it('reads the Playwright test folder and pattern from its config', () => {
    const [project] = detect({
      'apps/desktop/package.json': '{"devDependencies":{"@playwright/test":"1","vitest":"5"}}',
      'apps/desktop/e2e/playwright.config.ts':
        "export default defineConfig({ testDir: '.', testMatch: '**/*.e2e.ts', workers: 1 });",
    }).filter((p) => p.framework === 'playwright');
    expect(project).toEqual({
      id: 'playwright:apps/desktop',
      framework: 'playwright',
      root: 'apps/desktop',
      label: 'Playwright · apps/desktop',
      meta: { config: 'e2e/playwright.config.ts', testDir: 'e2e', testMatch: '**/*.e2e.ts' },
    });
  });

  it('reads Vitest include patterns from its config', () => {
    const [project] = detect({
      'package.json': '{"devDependencies":{"vitest":"5"}}',
      'vitest.config.mts':
        "export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });",
    });
    expect(project.meta).toEqual({ config: 'vitest.config.mts', include: 'src/**/*.test.ts' });
  });

  it('keeps each package of a monorepo separate', () => {
    expect(
      ids({
        'package.json': '{"devDependencies":{"@biomejs/biome":"2"}}',
        'packages/core/package.json': '{"devDependencies":{"vitest":"5"}}',
        'apps/desktop/package.json': '{"devDependencies":{"vitest":"5","@playwright/test":"1"}}',
        'services/api/go.mod': 'module example.com/api\n\ngo 1.22\n',
      }),
    ).toEqual([
      'playwright:apps/desktop',
      'vitest:apps/desktop',
      'vitest:packages/core',
      'go:services/api',
    ]);
  });

  it('finds pytest from its config, a conftest, or a requirement', () => {
    expect(ids({ 'pytest.ini': '[pytest]\n' })).toEqual(['pytest:']);
    expect(ids({ 'pyproject.toml': '[tool.pytest.ini_options]\naddopts = "-q"\n' })).toEqual([
      'pytest:',
    ]);
    expect(ids({ 'pyproject.toml': '[project]\nname = "x"\n', 'tests/conftest.py': '' })).toEqual([
      'pytest:',
    ]);
    expect(ids({ 'requirements-dev.txt': 'black\npytest==8.0\n' })).toEqual(['pytest:']);
    expect(ids({ 'pyproject.toml': '[dependency-groups]\ndev = ["pytest>=8"]\n' })).toEqual([
      'pytest:',
    ]);
  });

  it('falls back to unittest for Python tests with no pytest in sight', () => {
    expect(ids({ 'pyproject.toml': '[project]\nname = "x"\n' }, ['tests/test_app.py'])).toEqual([
      'unittest:',
    ]);
    expect(ids({}, ['app/test_models.py'])).toEqual(['unittest:']);
    expect(ids({ 'pyproject.toml': '[project]\nname = "x"\n' })).toEqual([]);
  });

  it('reads the Go module path', () => {
    expect(detect({ 'go.mod': 'module github.com/acme/tool\n\ngo 1.23\n' })).toEqual([
      {
        id: 'go:',
        framework: 'go',
        root: '',
        label: 'Go',
        meta: { module: 'github.com/acme/tool' },
      },
    ]);
  });

  it('finds Cargo packages but not a bare workspace manifest', () => {
    expect(
      ids({
        'Cargo.toml': '[workspace]\nmembers = ["crates/*"]\n',
        'crates/parser/Cargo.toml': '[package]\nname = "parser"\n',
      }),
    ).toEqual(['cargo:crates/parser']);
  });

  it('finds .NET test projects by their test SDK references', () => {
    expect(
      ids({
        'src/App/App.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
        'tests/App.Tests/App.Tests.csproj':
          '<Project><ItemGroup><PackageReference Include="xunit" Version="2.9.0" /></ItemGroup></Project>',
        'tests/Other/Other.fsproj':
          '<Project><ItemGroup><PackageReference Include="NUnit" /></ItemGroup></Project>',
      }),
    ).toEqual(['dotnet:tests/App.Tests', 'dotnet:tests/Other']);
  });

  it('tells Flutter from plain Dart', () => {
    expect(
      ids({
        'pubspec.yaml':
          'name: app\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n',
      }),
    ).toEqual(['flutter:']);
    expect(ids({ 'pubspec.yaml': 'name: lib\ndev_dependencies:\n  test: ^1.25.0\n' })).toEqual([
      'dart:',
    ]);
    expect(ids({ 'pubspec.yaml': 'name: lib\n' })).toEqual([]);
  });

  it('finds PHPUnit, RSpec, Gradle and Maven', () => {
    expect(ids({ 'composer.json': '{"require-dev":{"phpunit/phpunit":"^11"}}' })).toEqual([
      'phpunit:',
    ]);
    expect(ids({ 'phpunit.xml.dist': '<phpunit/>' })).toEqual(['phpunit:']);
    expect(ids({ Gemfile: "gem 'rspec-rails'\n" })).toEqual(['rspec:']);
    expect(ids({ '.rspec': '--require spec_helper' })).toEqual(['rspec:']);
    expect(ids({ 'build.gradle.kts': 'plugins { java }' }, ['gradlew'])).toEqual(['gradle:']);
    expect(detect({ 'build.gradle': '' }, ['gradlew.bat'])[0].meta).toEqual({ wrapper: 'true' });
    expect(ids({ 'pom.xml': '<project/>' })).toEqual(['maven:']);
  });

  it('only counts the top Gradle build of a multi-project build', () => {
    expect(
      ids({ 'settings.gradle': '', 'build.gradle': '', 'app/build.gradle': '' }, ['gradlew']),
    ).toEqual(['gradle:']);
  });

  it('ignores a package.json it cannot parse', () => {
    expect(ids({ 'package.json': '{ not json' })).toEqual([]);
  });
});
