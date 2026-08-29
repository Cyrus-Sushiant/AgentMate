import type { BlueprintPreset, BlueprintStepId } from '../types/index.js';

export interface BlueprintStepMeta {
  id: BlueprintStepId;
  /** Label on the step rail. */
  label: string;
  /** One-line subtitle under the label, the same role DiffrayReviewWizard's `hint` plays. */
  hint: string;
  /** Heading this step gets in the generated prompt and in the project's markdown block. */
  heading: string;
  placeholder: string;
}

/**
 * The one table behind the step rail, the prompt headings, the markdown block,
 * and the Settings preset groups. Nothing else in the app spells a step's name.
 */
export const BLUEPRINT_STEPS: BlueprintStepMeta[] = [
  {
    id: 'idea',
    label: 'Idea',
    hint: 'What you are building',
    heading: 'Main idea',
    placeholder:
      'What is this project, who is it for, and what problem does it solve? What does success look like, and what is explicitly out of scope?',
  },
  {
    id: 'architecture',
    label: 'Architecture',
    hint: 'Structure and stack',
    heading: 'Architecture and technology choices',
    placeholder:
      'How is the system laid out? Monolith, services, monorepo? Which languages, frameworks and hosting, and why those?',
  },
  {
    id: 'backend',
    label: 'Backend',
    hint: 'Services and data',
    heading: 'Backend',
    placeholder:
      'APIs, database, auth, background jobs, third-party services. Anything the server side has to get right.',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    hint: 'UI and client',
    heading: 'Frontend',
    placeholder:
      'Framework, state management, styling, routing, the screens that matter, accessibility and browser or device targets.',
  },
  {
    id: 'cicd',
    label: 'CI/CD',
    hint: 'Build and release',
    heading: 'CI/CD and environments',
    placeholder:
      'How this builds, tests, and ships. Pipelines, environments, secrets, versioning, and what has to pass before a release.',
  },
  {
    id: 'quality',
    label: 'Quality',
    hint: 'Testing and standards',
    heading: 'Quality, testing and constraints',
    placeholder:
      'Testing strategy, coverage expectations, linting and formatting rules, performance budgets, security and compliance constraints.',
  },
];

export function blueprintStep(stepId: BlueprintStepId): BlueprintStepMeta {
  // The list is exhaustive over the union, so the fallback only guards a value
  // that came in from disk or a backup and slipped past validation.
  return BLUEPRINT_STEPS.find((step) => step.id === stepId) ?? BLUEPRINT_STEPS[0];
}

/**
 * Seeded into blueprint-presets.json the first time it is read, so the chips
 * aren't empty on day one. Deleting one sticks: the seed only runs when the
 * file doesn't exist at all.
 */
export const DEFAULT_BLUEPRINT_PRESETS: Omit<BlueprintPreset, 'id' | 'createdAt'>[] = [
  {
    stepId: 'architecture',
    label: 'pnpm monorepo',
    text: 'pnpm workspaces monorepo: apps/* for deployables, packages/* for shared code. TypeScript everywhere, one tsconfig base.',
  },
  {
    stepId: 'architecture',
    label: 'Modular monolith',
    text: 'Modular monolith: one deployable, feature modules with explicit boundaries, no cross-module imports except through a published interface.',
  },
  {
    stepId: 'backend',
    label: 'Node + Fastify + Postgres',
    text: 'Node.js with Fastify, PostgreSQL through Prisma, Zod for request validation, JWT sessions with refresh tokens.',
  },
  {
    stepId: 'backend',
    label: 'ASP.NET Core Web API',
    text: 'ASP.NET Core Web API with EF Core and SQL Server, minimal APIs, FluentValidation, Serilog for structured logging.',
  },
  {
    stepId: 'frontend',
    label: 'React 19 + Vite + Tailwind',
    text: 'React 19 with Vite, TypeScript, Tailwind CSS, Radix primitives, TanStack Query for server state and zustand for client state.',
  },
  {
    stepId: 'frontend',
    label: 'Next.js App Router',
    text: 'Next.js with the App Router, server components by default, Tailwind CSS, server actions for mutations.',
  },
  {
    stepId: 'cicd',
    label: 'GitHub Actions',
    text: 'GitHub Actions: lint, type-check, test and build on every push and pull request. Release built and published on a v*.*.* tag.',
  },
  {
    stepId: 'cicd',
    label: 'Docker + staging',
    text: 'Docker image per service, pushed to a registry on merge to main. Staging deploys automatically, production behind a manual approval.',
  },
  {
    stepId: 'quality',
    label: 'Tests and lint gates',
    text: 'Unit tests for logic and integration tests for the API. Lint, format and type-check are blocking in CI. No merge with a failing pipeline.',
  },
  {
    stepId: 'quality',
    label: 'Conventional commits',
    text: 'Conventional Commits, squash merges, and a changelog generated from the commit history.',
  },
];

/** The starter set as storable records. `newId` is passed in so core stays free of node/web crypto. */
export function blueprintPresetSeed(newId: () => string): BlueprintPreset[] {
  const now = new Date().toISOString();
  return DEFAULT_BLUEPRINT_PRESETS.map((preset) => ({ ...preset, id: newId(), createdAt: now }));
}
