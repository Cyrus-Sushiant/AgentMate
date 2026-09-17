import type { TestFrameworkId } from './types.js';

export type TestLanguage =
  | 'js'
  | 'python'
  | 'go'
  | 'rust'
  | 'csharp'
  | 'dart'
  | 'php'
  | 'ruby'
  | 'jvm';

export interface TestFrameworkInfo {
  id: TestFrameworkId;
  label: string;
  language: TestLanguage;
  /** Where the framework looks for tests by default, relative to the project root. */
  testFiles: string[];
  /** Folders never worth reading for tests, relative to the project root. */
  ignore?: string[];
}

const JS_DEFAULT = ['**/*.@(spec|test).?(c|m)[jt]s?(x)', '**/__tests__/**/*.?(c|m)[jt]s?(x)'];

export const TEST_FRAMEWORKS: Record<TestFrameworkId, TestFrameworkInfo> = {
  vitest: { id: 'vitest', label: 'Vitest', language: 'js', testFiles: JS_DEFAULT },
  jest: { id: 'jest', label: 'Jest', language: 'js', testFiles: JS_DEFAULT },
  playwright: {
    id: 'playwright',
    label: 'Playwright',
    language: 'js',
    testFiles: ['**/*.@(spec|test).?(c|m)[jt]s?(x)'],
  },
  mocha: {
    id: 'mocha',
    label: 'Mocha',
    language: 'js',
    testFiles: ['test/**/*.?(c|m)[jt]s', '**/*.@(spec|test).?(c|m)[jt]s'],
  },
  pytest: {
    id: 'pytest',
    label: 'pytest',
    language: 'python',
    testFiles: ['**/test_*.py', '**/*_test.py'],
  },
  unittest: { id: 'unittest', label: 'unittest', language: 'python', testFiles: ['**/test*.py'] },
  go: { id: 'go', label: 'Go', language: 'go', testFiles: ['**/*_test.go'] },
  cargo: {
    id: 'cargo',
    label: 'Cargo',
    language: 'rust',
    testFiles: ['src/**/*.rs', 'tests/**/*.rs'],
  },
  dotnet: {
    id: 'dotnet',
    label: '.NET',
    language: 'csharp',
    testFiles: ['**/*.cs'],
    ignore: ['bin', 'obj'],
  },
  dart: { id: 'dart', label: 'Dart', language: 'dart', testFiles: ['test/**/*_test.dart'] },
  flutter: {
    id: 'flutter',
    label: 'Flutter',
    language: 'dart',
    testFiles: ['test/**/*_test.dart'],
  },
  phpunit: { id: 'phpunit', label: 'PHPUnit', language: 'php', testFiles: ['tests/**/*Test.php'] },
  rspec: { id: 'rspec', label: 'RSpec', language: 'ruby', testFiles: ['spec/**/*_spec.rb'] },
  gradle: {
    id: 'gradle',
    label: 'Gradle',
    language: 'jvm',
    testFiles: ['**/src/test/**/*.java', '**/src/test/**/*.kt'],
  },
  maven: {
    id: 'maven',
    label: 'Maven',
    language: 'jvm',
    testFiles: ['**/src/test/**/*.java', '**/src/test/**/*.kt'],
  },
};

/** Folders no runner looks in, skipped wherever they appear. */
export const IGNORED_TEST_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'out',
  'out-e2e',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  'target',
  '.dart_tool',
  'vendor',
  '.gradle',
];
