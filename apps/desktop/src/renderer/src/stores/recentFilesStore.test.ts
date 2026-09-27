import { describe, expect, it } from 'vitest';
import { MAX_RECENT_FILES, MAX_RECENT_PROJECTS, useRecentFilesStore } from './recentFilesStore';

function store() {
  return useRecentFilesStore.getState();
}

function recent(projectId: string): string[] {
  return store().byProject[projectId] ?? [];
}

describe('recentFilesStore', () => {
  it('puts the latest file first, once', () => {
    store().touch('p1', '/a.ts');
    store().touch('p1', '/b.ts');
    store().touch('p1', '/a.ts');
    expect(recent('p1')).toEqual(['/a.ts', '/b.ts']);
  });

  it('keeps each project to itself', () => {
    store().touch('p1', '/a.ts');
    store().touch('p2', '/z.ts');
    expect(recent('p1')).toEqual(['/a.ts']);
    expect(recent('p2')).toEqual(['/z.ts']);
  });

  it('holds only the latest few files', () => {
    for (let at = 0; at < MAX_RECENT_FILES + 5; at += 1) store().touch('p1', `/f${at}.ts`);
    expect(recent('p1')).toHaveLength(MAX_RECENT_FILES);
    expect(recent('p1')[0]).toBe(`/f${MAX_RECENT_FILES + 4}.ts`);
  });

  it('forgets the project used longest ago once there are too many', () => {
    for (let at = 0; at <= MAX_RECENT_PROJECTS; at += 1) store().touch(`p${at}`, '/a.ts');
    expect(store().byProject.p0).toBeUndefined();
    expect(Object.keys(store().byProject)).toHaveLength(MAX_RECENT_PROJECTS);
  });

  it('follows a rename, including a moved folder', () => {
    store().touch('p1', 'E:\\proj\\src\\a.ts');
    store().touch('p1', 'E:\\proj\\b.ts');
    store().remap('p1', 'E:\\proj\\src', 'E:\\proj\\lib');
    expect(recent('p1')).toEqual(['E:\\proj\\b.ts', 'E:\\proj\\lib\\a.ts']);
  });

  it('forgets deleted files and everything under a deleted folder', () => {
    store().touch('p1', '/proj/src/a.ts');
    store().touch('p1', '/proj/b.ts');
    store().forget('p1', ['/proj/src']);
    expect(recent('p1')).toEqual(['/proj/b.ts']);
  });
});
