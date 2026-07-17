import type { PromptType } from './types.js';

export interface PromptTypeProfile {
  roleLabel: string;
  focusAreas: string[];
  requirements: string[];
  bestPractices: string[];
}

const DEFAULT_PROFILE: PromptTypeProfile = {
  roleLabel: 'senior software engineer',
  focusAreas: ['Correctness', 'Maintainability', 'Clarity'],
  requirements: ['Solve the stated problem completely', 'Keep the change scoped to what was asked'],
  bestPractices: ['Follow existing project conventions', 'Prefer simple, readable solutions'],
};

export const PROMPT_TYPE_PROFILES: Record<PromptType, PromptTypeProfile> = {
  Frontend: {
    roleLabel: 'senior frontend engineer',
    focusAreas: ['Component structure', 'State management', 'Responsive layout', 'Accessibility'],
    requirements: ['Match existing component patterns', 'Handle loading, empty, and error states'],
    bestPractices: ['Use semantic HTML and ARIA where relevant', 'Avoid unnecessary re-renders'],
  },
  Backend: {
    roleLabel: 'senior backend engineer',
    focusAreas: ['API contracts', 'Data validation', 'Error handling', 'Scalability'],
    requirements: ['Validate all external input', 'Return consistent, well-structured errors'],
    bestPractices: ['Keep business logic out of route handlers', 'Log at appropriate levels'],
  },
  'Full Stack': {
    roleLabel: 'senior full-stack engineer',
    focusAreas: ['End-to-end data flow', 'API/UI contract alignment', 'Consistency across layers'],
    requirements: ['Keep frontend and backend types in sync', 'Cover the full request/response path'],
    bestPractices: ['Share types between client and server where possible'],
  },
  'UI Design': {
    roleLabel: 'senior product/UI designer',
    focusAreas: ['Visual hierarchy', 'Spacing and typography', 'Consistency with design system'],
    requirements: ['Specify concrete layout, spacing, and color decisions', 'Cover light and dark themes'],
    bestPractices: ['Reuse existing design tokens/components before introducing new ones'],
  },
  'UX Review': {
    roleLabel: 'senior UX researcher',
    focusAreas: ['User flow friction', 'Cognitive load', 'Error recovery', 'Onboarding clarity'],
    requirements: ['Identify concrete friction points, not just impressions', 'Propose specific fixes'],
    bestPractices: ['Ground feedback in usability heuristics (Nielsen, etc.)'],
  },
  API: {
    roleLabel: 'senior API engineer',
    focusAreas: ['Resource modeling', 'Versioning', 'Error semantics', 'Auth boundaries'],
    requirements: ['Define request/response schemas explicitly', 'Cover pagination and error cases'],
    bestPractices: ['Follow REST/GraphQL conventions already used in this project'],
  },
  Database: {
    roleLabel: 'senior database engineer',
    focusAreas: ['Schema design', 'Indexing', 'Migration safety', 'Query performance'],
    requirements: ['Provide a migration path for existing data', 'Avoid destructive schema changes without a plan'],
    bestPractices: ['Prefer additive migrations', 'Consider lock/downtime impact on large tables'],
  },
  Testing: {
    roleLabel: 'senior test engineer',
    focusAreas: ['Coverage of edge cases', 'Test isolation', 'Determinism'],
    requirements: ['Cover the happy path plus meaningful edge cases', 'Avoid flaky or order-dependent tests'],
    bestPractices: ['Test behavior, not implementation details', 'Use realistic fixtures over mocks where practical'],
  },
  Security: {
    roleLabel: 'senior application security engineer',
    focusAreas: ['Input validation', 'AuthN/AuthZ boundaries', 'Secrets handling', 'Common OWASP risks'],
    requirements: ['Call out any trust boundary the change crosses', 'Do not weaken existing security controls'],
    bestPractices: ['Validate at the boundary, never trust client input', 'Least privilege by default'],
  },
  Performance: {
    roleLabel: 'senior performance engineer',
    focusAreas: ['Hot paths', 'Algorithmic complexity', 'Memory/CPU footprint', 'I/O and network cost'],
    requirements: ['Identify the specific bottleneck before optimizing', 'Preserve correctness while optimizing'],
    bestPractices: ['Measure before and after', 'Prefer algorithmic fixes over micro-optimizations'],
  },
  DevOps: {
    roleLabel: 'senior DevOps engineer',
    focusAreas: ['CI/CD pipeline', 'Infrastructure as code', 'Observability', 'Rollback safety'],
    requirements: ['Ensure changes are reversible', 'Keep environments (dev/stage/prod) consistent'],
    bestPractices: ['Automate repeatable operational steps', 'Fail fast with clear diagnostics'],
  },
  Documentation: {
    roleLabel: 'senior technical writer',
    focusAreas: ['Accuracy', 'Discoverability', 'Audience-appropriate depth'],
    requirements: ['Document the why, not just the what', 'Keep examples runnable/copy-pastable'],
    bestPractices: ['Prefer concise, scannable structure with headers'],
  },
  Refactoring: {
    roleLabel: 'senior software engineer focused on refactoring',
    focusAreas: ['Behavior preservation', 'Reduced complexity', 'Improved naming/structure'],
    requirements: ['Do not change external behavior unless explicitly requested', 'Keep the diff reviewable'],
    bestPractices: ['Refactor in small, verifiable steps', 'Add tests first if coverage is missing'],
  },
  'Bug Fix': {
    roleLabel: 'senior debugging specialist',
    focusAreas: ['Root cause identification', 'Regression risk', 'Minimal blast radius'],
    requirements: ['Fix the root cause, not just the symptom', 'Add a test that reproduces the bug'],
    bestPractices: ['Avoid unrelated changes in the same fix', 'Explain the root cause in the summary'],
  },
  'Code Review': {
    roleLabel: 'senior code reviewer',
    focusAreas: ['Correctness', 'Security', 'Readability', 'Test coverage'],
    requirements: ['Flag concrete issues with file/line references', 'Distinguish blocking issues from nits'],
    bestPractices: ['Prioritize correctness and security bugs over style preferences'],
  },
  Architecture: {
    roleLabel: 'senior software architect',
    focusAreas: ['Module boundaries', 'Scalability', 'Extensibility', 'Trade-off analysis'],
    requirements: ['Present trade-offs, not just a single answer', 'Consider long-term maintenance cost'],
    bestPractices: ['Favor boring, proven patterns over novel ones unless justified'],
  },
  Mobile: {
    roleLabel: 'senior mobile engineer',
    focusAreas: ['Platform conventions (iOS/Android)', 'Offline behavior', 'Battery/network efficiency'],
    requirements: ['Respect platform-specific UI conventions', 'Handle offline and low-connectivity states'],
    bestPractices: ['Test on both small and large screen sizes'],
  },
  Electron: {
    roleLabel: 'senior Electron engineer',
    focusAreas: ['Main/renderer/preload boundaries', 'IPC security', 'Native module compatibility'],
    requirements: ['Keep contextIsolation and sandboxing intact', 'Never expose raw ipcRenderer.invoke passthrough'],
    bestPractices: ['Validate all data crossing the IPC boundary', 'Keep Node-only APIs out of the renderer'],
  },
  React: {
    roleLabel: 'senior React engineer',
    focusAreas: ['Component composition', 'Hooks correctness', 'Rendering performance'],
    requirements: ['Respect the rules of hooks', 'Avoid prop drilling where context/state libraries fit better'],
    bestPractices: ['Keep components small and focused', 'Memoize only where profiling shows it matters'],
  },
  'Next.js': {
    roleLabel: 'senior Next.js engineer',
    focusAreas: ['App/Pages router conventions', 'Server vs client components', 'Data fetching strategy'],
    requirements: ['Use the correct rendering strategy (SSR/SSG/ISR/client) for the use case'],
    bestPractices: ['Keep server-only code out of client bundles'],
  },
  'Node.js': {
    roleLabel: 'senior Node.js engineer',
    focusAreas: ['Async correctness', 'Error propagation', 'Process/resource lifecycle'],
    requirements: ['Handle promise rejections explicitly', 'Avoid blocking the event loop'],
    bestPractices: ['Prefer async/await with explicit try/catch over unhandled promise chains'],
  },
  '.NET': {
    roleLabel: 'senior .NET engineer',
    focusAreas: ['C# idioms', 'Dependency injection', 'Async/await correctness'],
    requirements: ['Follow existing project DI and layering conventions'],
    bestPractices: ['Use nullable reference types deliberately', 'Dispose IDisposable resources correctly'],
  },
  Flutter: {
    roleLabel: 'senior Flutter engineer',
    focusAreas: ['Widget composition', 'State management approach', 'Platform-adaptive UI'],
    requirements: ['Keep widget rebuilds scoped', "Respect the project's state management pattern"],
    bestPractices: ['Prefer const constructors where possible'],
  },
  Python: {
    roleLabel: 'senior Python engineer',
    focusAreas: ['Type hints', 'Idiomatic Python', 'Dependency management'],
    requirements: ['Add type hints for new public functions', 'Follow PEP 8 conventions'],
    bestPractices: ['Prefer standard library solutions before adding dependencies'],
  },
  'AI Agent': {
    roleLabel: 'senior AI agent engineer',
    focusAreas: ['Tool/function design', 'Prompt structure', 'Failure handling', 'Context management'],
    requirements: ['Define clear tool boundaries and inputs/outputs', 'Handle model failures/timeouts gracefully'],
    bestPractices: ['Keep tools narrow and composable', 'Make agent behavior observable/debuggable'],
  },
  Custom: DEFAULT_PROFILE,
};
