import {
  activateTab,
  addTab,
  allGroups,
  allTabIds,
  createGroup,
  findGroup,
  findGroupOfTab,
  firstGroup,
  moveTab,
  normalizeLayout,
  type PaneNode,
  removeGroup,
  removeTab,
  replaceTabId,
  type SplitDirection,
  setRatio,
  splitGroup,
} from '@agentmat/core';
import type { GitDiffSide } from '@shared/apiTypes';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { terminalRuntime } from '@/lib/terminal/terminalRuntime';

export type { GitDiffSide };

export interface WorkspaceTerminalTab {
  kind: 'terminal';
  /** Doubles as the pty session id, which is how a tab finds its shell after a restart. */
  id: string;
  title: string;
  /** A name the user gave the tab. Wins over `title` and the program's own title. */
  userTitle?: string;
  cliId?: string;
  shell?: string;
  cwd: string;
  createdAt: number;
  /** Typed into the shell when it first starts, and again on a restart (the agent's command). */
  launchInput?: string;
  /** The model and effort the tab was launched with, when chosen at launch ("Opus 5 · High"). */
  runLabel?: string;
  restored?: boolean;
}

export interface WorkspaceDiffTab {
  kind: 'diff';
  id: string;
  path: string;
  /** For a staged rename, where the file came from. */
  origPath?: string;
  side: GitDiffSide;
  /** Set for a file as a past commit changed it, rather than a working tree change. */
  commit?: string;
  /** A preview tab is replaced by the next file opened, until the user pins it. */
  preview: boolean;
}

/** A project file opened for reading or editing, from the explorer. */
export interface WorkspaceFileTab {
  kind: 'file';
  id: string;
  /** Absolute path on disk. */
  path: string;
  preview: boolean;
}

export type WorkspaceTab = WorkspaceTerminalTab | WorkspaceDiffTab | WorkspaceFileTab;

/** The tabs of the right-hand panel. */
export type SidePanelSection =
  | 'changes'
  | 'commits'
  | 'branches'
  | 'explorer'
  | 'history'
  | 'pipelines';

export const SIDE_PANEL_SECTIONS: SidePanelSection[] = [
  'changes',
  'commits',
  'branches',
  'explorer',
  'history',
  'pipelines',
];

export interface ProjectWorkspace {
  root: PaneNode;
  tabs: Record<string, WorkspaceTab>;
  focusedGroupId: string;
  /** A group blown up to fill the whole center area, or null. */
  zoomedGroupId: string | null;
}

export const GIT_PANEL_MIN_WIDTH = 240;
export const GIT_PANEL_MAX_WIDTH = 560;
export const GIT_PANEL_DEFAULT_WIDTH = 320;

export type GitPanelSection = 'conflicts' | 'staged' | 'unstaged' | 'untracked';

interface GitPanelPrefs {
  width: number;
  collapsed: boolean;
  collapsedSections: Partial<Record<GitPanelSection, boolean>>;
  diffSideBySide: boolean;
  diffIgnoreWhitespace: boolean;
  /** Which panel tab is showing. */
  activeSection: SidePanelSection;
}

export type NewTerminalTab = Omit<WorkspaceTerminalTab, 'kind' | 'id' | 'createdAt'>;

interface WorkspaceState {
  workspaces: Record<string, ProjectWorkspace>;
  /** Projects open in the rail, in the order they were opened. */
  railProjectIds: string[];
  activeProjectId: string | null;
  gitPanel: GitPanelPrefs;

  openProject: (projectId: string) => void;
  /** Removes a project from the rail and ends every shell it had open. */
  closeProject: (projectId: string) => void;
  addTerminal: (projectId: string, tab: NewTerminalTab, groupId?: string) => string;
  /** Closes a tab. Terminal tabs end their shell. */
  closeTab: (projectId: string, tabId: string) => void;
  /** Starts a fresh shell in place of an ended one, same position and launch settings. */
  restartTab: (projectId: string, tabId: string) => void;
  activateTab: (projectId: string, tabId: string) => void;
  focusGroup: (projectId: string, groupId: string) => void;
  /** Splits a group and returns the new, empty group's id. */
  splitGroup: (
    projectId: string,
    groupId: string,
    direction: SplitDirection,
    side?: 'before' | 'after',
  ) => string;
  /** Closes a pane and every tab in it. */
  closeGroup: (projectId: string, groupId: string) => void;
  moveTab: (projectId: string, tabId: string, groupId: string, index?: number) => void;
  setSplitRatio: (projectId: string, splitId: string, ratio: number) => void;
  renameTab: (projectId: string, tabId: string, title: string) => void;
  toggleZoom: (projectId: string, groupId: string) => void;
  /**
   * Shows a file's diff. An already open tab for it comes forward; otherwise it replaces the
   * focused pane's preview tab, or opens a new preview tab. `pin` keeps it open for good.
   */
  openDiff: (
    projectId: string,
    file: { path: string; side: GitDiffSide; origPath?: string; commit?: string },
    options?: { pin?: boolean },
  ) => void;
  /** Opens a project file in an editor tab, with the same preview behavior as diffs. */
  openFile: (projectId: string, path: string, options?: { pin?: boolean }) => void;
  setGitPanel: (patch: Partial<GitPanelPrefs>) => void;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function emptyWorkspace(): ProjectWorkspace {
  const group = createGroup(newId('g'));
  return { root: group, tabs: {}, focusedGroupId: group.id, zoomedGroupId: null };
}

/** Keeps focus and zoom pointing at groups that still exist after the tree changed. */
function settle(workspace: ProjectWorkspace): ProjectWorkspace {
  const groups = allGroups(workspace.root);
  const focusedGroupId = groups.some((g) => g.id === workspace.focusedGroupId)
    ? workspace.focusedGroupId
    : firstGroup(workspace.root).id;
  const zoomedGroupId =
    workspace.zoomedGroupId &&
    groups.length > 1 &&
    groups.some((g) => g.id === workspace.zoomedGroupId)
      ? workspace.zoomedGroupId
      : null;
  return { ...workspace, focusedGroupId, zoomedGroupId };
}

type PreviewableTab = WorkspaceDiffTab | WorkspaceFileTab;

/**
 * Brings up a diff or file tab. An existing tab for the same thing comes forward (and is
 * pinned if asked); otherwise the focused pane's preview tab is reused, or a new one opens.
 */
function openPreviewable(
  ws: ProjectWorkspace,
  matches: (tab: WorkspaceTab) => boolean,
  build: (id: string) => PreviewableTab,
  pin: boolean,
): ProjectWorkspace {
  const same = Object.values(ws.tabs).find(matches) as PreviewableTab | undefined;
  if (same) {
    const group = findGroupOfTab(ws.root, same.id);
    return {
      ...ws,
      root: activateTab(ws.root, same.id),
      focusedGroupId: group?.id ?? ws.focusedGroupId,
      tabs: pin ? { ...ws.tabs, [same.id]: { ...same, preview: false } } : ws.tabs,
    };
  }
  const focused = findGroup(ws.root, ws.focusedGroupId);
  const preview = focused?.tabIds
    .map((id) => ws.tabs[id])
    .find((t): t is PreviewableTab => (t?.kind === 'diff' || t?.kind === 'file') && t.preview);
  const next = build(preview?.id ?? newId('view'));
  return {
    ...ws,
    root: preview ? activateTab(ws.root, next.id) : addTab(ws.root, ws.focusedGroupId, next.id),
    tabs: { ...ws.tabs, [next.id]: next },
    zoomedGroupId: null,
  };
}

function endTab(tab: WorkspaceTab | undefined): void {
  if (tab?.kind !== 'terminal') return;
  void window.agentmat.terminal.kill(tab.id);
  terminalRuntime.dispose(tab.id);
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => {
      const update = (projectId: string, fn: (ws: ProjectWorkspace) => ProjectWorkspace): void => {
        set((state) => {
          const current = state.workspaces[projectId];
          if (!current) return state;
          return { workspaces: { ...state.workspaces, [projectId]: settle(fn(current)) } };
        });
      };

      return {
        workspaces: {},
        railProjectIds: [],
        activeProjectId: null,
        gitPanel: {
          width: GIT_PANEL_DEFAULT_WIDTH,
          collapsed: false,
          collapsedSections: {},
          diffSideBySide: true,
          diffIgnoreWhitespace: false,
          activeSection: 'changes',
        },

        openProject: (projectId) =>
          set((state) => ({
            activeProjectId: projectId,
            railProjectIds: state.railProjectIds.includes(projectId)
              ? state.railProjectIds
              : [...state.railProjectIds, projectId],
            workspaces: state.workspaces[projectId]
              ? state.workspaces
              : { ...state.workspaces, [projectId]: emptyWorkspace() },
          })),

        closeProject: (projectId) => {
          const workspace = get().workspaces[projectId];
          for (const tab of Object.values(workspace?.tabs ?? {})) endTab(tab);
          set((state) => {
            const { [projectId]: _closed, ...workspaces } = state.workspaces;
            const railProjectIds = state.railProjectIds.filter((id) => id !== projectId);
            const index = state.railProjectIds.indexOf(projectId);
            return {
              workspaces,
              railProjectIds,
              activeProjectId:
                state.activeProjectId === projectId
                  ? (railProjectIds[Math.min(index, railProjectIds.length - 1)] ?? null)
                  : state.activeProjectId,
            };
          });
        },

        addTerminal: (projectId, tab, groupId) => {
          const id = crypto.randomUUID();
          update(projectId, (ws) => {
            const target = groupId && findGroup(ws.root, groupId) ? groupId : ws.focusedGroupId;
            return {
              ...ws,
              root: addTab(ws.root, target, id),
              tabs: { ...ws.tabs, [id]: { ...tab, kind: 'terminal', id, createdAt: Date.now() } },
              focusedGroupId: target,
            };
          });
          return id;
        },

        closeTab: (projectId, tabId) => {
          endTab(get().workspaces[projectId]?.tabs[tabId]);
          update(projectId, (ws) => {
            const { [tabId]: _closed, ...tabs } = ws.tabs;
            return { ...ws, root: removeTab(ws.root, tabId).root, tabs };
          });
        },

        restartTab: (projectId, tabId) => {
          const old = get().workspaces[projectId]?.tabs[tabId];
          if (old?.kind !== 'terminal') return;
          endTab(old);
          const id = crypto.randomUUID();
          update(projectId, (ws) => {
            const { [tabId]: _old, ...tabs } = ws.tabs;
            const fresh: WorkspaceTerminalTab = {
              ...old,
              id,
              createdAt: Date.now(),
              restored: false,
            };
            return {
              ...ws,
              root: replaceTabId(ws.root, tabId, id),
              tabs: { ...tabs, [id]: fresh },
            };
          });
        },

        activateTab: (projectId, tabId) =>
          update(projectId, (ws) => {
            const group = findGroupOfTab(ws.root, tabId);
            return {
              ...ws,
              root: activateTab(ws.root, tabId),
              focusedGroupId: group?.id ?? ws.focusedGroupId,
            };
          }),

        focusGroup: (projectId, groupId) =>
          update(projectId, (ws) =>
            ws.focusedGroupId === groupId ? ws : { ...ws, focusedGroupId: groupId },
          ),

        splitGroup: (projectId, groupId, direction, side = 'after') => {
          const group = createGroup(newId('g'));
          update(projectId, (ws) => ({
            ...ws,
            root: splitGroup(ws.root, groupId, direction, group, newId('s'), side),
            focusedGroupId: group.id,
            zoomedGroupId: null,
          }));
          return group.id;
        },

        closeGroup: (projectId, groupId) => {
          const ws = get().workspaces[projectId];
          const group = ws ? findGroup(ws.root, groupId) : null;
          if (!ws || !group) return;
          for (const tabId of group.tabIds) endTab(ws.tabs[tabId]);
          update(projectId, (current) => {
            const tabs = { ...current.tabs };
            for (const tabId of group.tabIds) delete tabs[tabId];
            let root = removeGroup(current.root, groupId);
            // The last pane stays, emptied, so the workspace keeps somewhere to launch from.
            if (root.type === 'group' && root.id === groupId) root = createGroup(groupId);
            return { ...current, root, tabs };
          });
        },

        moveTab: (projectId, tabId, groupId, index) =>
          update(projectId, (ws) => ({
            ...ws,
            root: moveTab(ws.root, tabId, groupId, index),
            focusedGroupId: groupId,
          })),

        setSplitRatio: (projectId, splitId, ratio) =>
          update(projectId, (ws) => ({ ...ws, root: setRatio(ws.root, splitId, ratio) })),

        renameTab: (projectId, tabId, title) =>
          update(projectId, (ws) => {
            const tab = ws.tabs[tabId];
            if (tab?.kind !== 'terminal') return ws;
            const userTitle = title.trim() || undefined;
            return { ...ws, tabs: { ...ws.tabs, [tabId]: { ...tab, userTitle } } };
          }),

        toggleZoom: (projectId, groupId) =>
          update(projectId, (ws) => ({
            ...ws,
            zoomedGroupId: ws.zoomedGroupId === groupId ? null : groupId,
            focusedGroupId: groupId,
          })),

        openDiff: (projectId, file, options = {}) =>
          update(projectId, (ws) =>
            openPreviewable(
              ws,
              (t) =>
                t.kind === 'diff' &&
                t.path === file.path &&
                t.side === file.side &&
                t.commit === file.commit,
              (id) => ({
                kind: 'diff',
                id,
                path: file.path,
                origPath: file.origPath,
                side: file.side,
                commit: file.commit,
                preview: !options.pin,
              }),
              options.pin === true,
            ),
          ),

        openFile: (projectId, path, options = {}) =>
          update(projectId, (ws) =>
            openPreviewable(
              ws,
              (t) => t.kind === 'file' && t.path === path,
              (id) => ({ kind: 'file', id, path, preview: !options.pin }),
              options.pin === true,
            ),
          ),

        setGitPanel: (patch) => set((state) => ({ gitPanel: { ...state.gitPanel, ...patch } })),
      };
    },
    {
      name: 'agentmate-workspaces',
      version: 1,
      partialize: (state) => ({
        railProjectIds: state.railProjectIds,
        activeProjectId: state.activeProjectId,
        gitPanel: state.gitPanel,
        workspaces: Object.fromEntries(
          Object.entries(state.workspaces).map(([projectId, ws]) => {
            // Preview diffs are throwaway by definition. Terminal tabs keep their launch input:
            // a restored tab only reconnects, so it is typed again only on an explicit restart.
            const tabs = Object.fromEntries(
              Object.entries(ws.tabs).filter(
                ([, tab]) => !((tab.kind === 'diff' || tab.kind === 'file') && tab.preview),
              ),
            );
            const kept = new Set(Object.keys(tabs));
            let root = ws.root;
            for (const id of allTabIds(ws.root)) if (!kept.has(id)) root = removeTab(root, id).root;
            return [projectId, { ...ws, root, tabs }];
          }),
        ),
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<WorkspaceState>;
        const workspaces: Record<string, ProjectWorkspace> = {};
        for (const [projectId, ws] of Object.entries(saved.workspaces ?? {})) {
          const tabs: Record<string, WorkspaceTab> = {};
          for (const [id, tab] of Object.entries(ws?.tabs ?? {})) {
            if (tab?.kind === 'terminal') tabs[id] = { ...tab, restored: true };
            else if (tab?.kind === 'diff' || tab?.kind === 'file') tabs[id] = tab;
          }
          const root = normalizeLayout(ws?.root, new Set(Object.keys(tabs)), newId('g'));
          const placed = new Set(allTabIds(root));
          for (const id of Object.keys(tabs)) if (!placed.has(id)) delete tabs[id];
          workspaces[projectId] = settle({
            root,
            tabs,
            focusedGroupId: typeof ws?.focusedGroupId === 'string' ? ws.focusedGroupId : '',
            zoomedGroupId: typeof ws?.zoomedGroupId === 'string' ? ws.zoomedGroupId : null,
          });
        }
        const railProjectIds = (saved.railProjectIds ?? []).filter((id) => workspaces[id]);
        return {
          ...current,
          workspaces,
          railProjectIds,
          activeProjectId:
            saved.activeProjectId && workspaces[saved.activeProjectId]
              ? saved.activeProjectId
              : (railProjectIds[0] ?? null),
          gitPanel: {
            ...current.gitPanel,
            ...(saved.gitPanel ?? {}),
            // A tab id saved by an older build may no longer exist.
            activeSection: SIDE_PANEL_SECTIONS.includes(saved.gitPanel?.activeSection as never)
              ? (saved.gitPanel?.activeSection as SidePanelSection)
              : 'changes',
          },
        };
      },
    },
  ),
);

/** The name a terminal tab shows: the one the user gave it, else the one it was launched with. */
export function terminalTabLabel(tab: WorkspaceTerminalTab): string {
  return tab.userTitle ?? tab.title;
}
