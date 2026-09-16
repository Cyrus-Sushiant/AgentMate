import type { Project } from '@agentmat/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useVersionDialogStore } from '@/stores/versionDialogStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The route element for `/workspace` and `/workspace/:projectId`. The page itself is the
 * always-mounted WorkspaceHost; this only keeps the store in step with the URL.
 */
export default function WorkspaceRoute(): null {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const openProject = useWorkspaceStore((s) => s.openProject);
  const activateTab = useWorkspaceStore((s) => s.activateTab);
  const projectsQuery = useQuery<Project[]>({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const project = projectsQuery.data?.find((p) => p.id === projectId);
  const queryClient = useQueryClient();

  // A link to a project the cached list has not seen yet (just created): fetch it.
  const unknown = Boolean(projectId && projectsQuery.data && !project);
  useEffect(() => {
    if (unknown) void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
  }, [unknown, queryClient]);

  usePageHeader('Workspace', project ? `${project.name} · ${project.folderPath}` : undefined);

  useEffect(() => {
    if (projectId) {
      openProject(projectId);
      return;
    }
    const last = useWorkspaceStore.getState().activeProjectId;
    if (last) navigate(`/workspace/${last}`, { replace: true });
  }, [projectId, openProject, navigate]);

  // `?session=<id>` comes from a notification click: bring that tab forward.
  const session = searchParams.get('session');
  useEffect(() => {
    if (!projectId || !session) return;
    activateTab(projectId, session);
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next, { replace: true });
  }, [projectId, session, searchParams, setSearchParams, activateTab]);

  // `?tag=1` comes from a "version files updated" notification: reopen that flow.
  const openTagDialog = searchParams.get('tag');
  useEffect(() => {
    if (!projectId || !openTagDialog) return;
    useVersionDialogStore.getState().open(projectId);
    const next = new URLSearchParams(searchParams);
    next.delete('tag');
    setSearchParams(next, { replace: true });
  }, [projectId, openTagDialog, searchParams, setSearchParams]);

  return null;
}
