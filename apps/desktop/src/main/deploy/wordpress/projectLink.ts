import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  normalizeProjectWordPressLink,
  type Project,
  type ProjectWordPressLink,
  type WpItemRef,
  wpItemKey,
  wpItemRoot,
} from '@agentmat/core';
import type { CreateProjectInput } from '../../../shared/apiTypes';
import { wordPressError } from '../../../shared/wordpressErrors';
import { itemRootKind } from './localManifest';

/**
 * A project's link to a WordPress site (E21), as the main process uses it: which site, which
 * items, and where each item's folder sits. Projects themselves are kept by the Projects store;
 * this only reads them and changes their link through the port the wiring hands in.
 */

export interface WpProjectsPort {
  get(projectId: string): Promise<Project | null>;
  /** projects.ts createProjectRecord: the only way a project is made with a link. */
  create(input: CreateProjectInput): Promise<Project>;
  /** projects.ts setProjectWordPressLink; undefined removes the link. */
  setLink(projectId: string, link: ProjectWordPressLink | undefined): Promise<Project>;
}

export interface WpLinkedProject {
  project: Project;
  link: ProjectWordPressLink;
}

export async function requireLinkedProject(
  projects: WpProjectsPort,
  projectId: string,
): Promise<WpLinkedProject> {
  const project = await projects.get(projectId);
  if (!project) {
    throw wordPressError('projectNotLinked', 'That project no longer exists.');
  }
  const link = normalizeProjectWordPressLink(project.wordpress);
  if (!link) {
    throw wordPressError(
      'projectNotLinked',
      'This project is not linked to a WordPress site. Link it from the WordPress section first.',
    );
  }
  return { project, link };
}

/** The items asked for, which must all be linked; every linked item when none are named. */
export function selectItems(link: ProjectWordPressLink, requested?: readonly WpItemRef[]) {
  if (!requested) return link.items;
  const linked = new Set(link.items.map(wpItemKey));
  for (const item of requested) {
    if (!linked.has(wpItemKey(item))) {
      throw wordPressError(
        'badRequest',
        `${wpItemRoot(item)} is not linked to this project. Add it to the project first.`,
      );
    }
  }
  return [...requested];
}

export function newWpLink(
  siteId: string,
  items: readonly WpItemRef[],
  now: number,
): ProjectWordPressLink {
  return {
    siteId,
    items: items.map((item) => ({ kind: item.kind, slug: item.slug })),
    linkedAt: new Date(now).toISOString(),
  };
}

/** Each item's folder (or file) in the project must be missing or an empty folder. */
export async function assertItemFoldersEmpty(
  projectRoot: string,
  items: readonly WpItemRef[],
): Promise<void> {
  const taken: string[] = [];
  for (const item of items) {
    const kind = await itemRootKind(projectRoot, item);
    if (kind === null) continue;
    if (kind === 'folder') {
      const entries = await readdir(join(projectRoot, wpItemRoot(item)));
      if (entries.length === 0) continue;
    }
    taken.push(wpItemRoot(item));
  }
  if (taken.length > 0) {
    throw wordPressError(
      'folderNotEmpty',
      [
        taken.length === 1
          ? 'This folder already holds files, so AgentMate will not pull into it:'
          : 'These folders already hold files, so AgentMate will not pull into them:',
        ...taken,
      ].join('\n'),
    );
  }
}
