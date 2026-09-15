import type { DockerContainer, DockerRemoveOptions } from '@shared/apiTypes';
import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

type LifecycleAction = 'start' | 'stop' | 'restart';

/**
 * Start/stop/restart/remove wiring shared by the machine-wide Docker page and a project's Docker
 * tab. Both call the same four IPC methods and need the same pending/dialog state, so this is the
 * one place that logic lives rather than being copied twice.
 */
export function useDockerContainerActions(queryKey: QueryKey): {
  pendingId: string | null;
  removeTarget: DockerContainer | null;
  removing: boolean;
  openRemoveDialog: (container: DockerContainer) => void;
  closeRemoveDialog: () => void;
  start: (id: string) => void;
  stop: (id: string) => void;
  restart: (id: string) => void;
  confirmRemove: (options: DockerRemoveOptions) => void;
} {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<DockerContainer | null>(null);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey });
  }

  const lifecycleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: LifecycleAction }) => {
      if (action === 'start') return window.agentmat.docker.start(id);
      if (action === 'stop') return window.agentmat.docker.stop(id);
      return window.agentmat.docker.restart(id);
    },
    onMutate: ({ id }) => setPendingId(id),
    onSuccess: (result) => {
      if (!result.ok) toast.error(result.error ?? 'That action failed.');
    },
    onError: () => toast.error('That action failed.'),
    onSettled: () => {
      setPendingId(null);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ id, options }: { id: string; options: DockerRemoveOptions }) =>
      window.agentmat.docker.remove(id, options),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Container removed.');
        setRemoveTarget(null);
      } else {
        toast.error(result.error ?? 'Could not remove the container.');
      }
    },
    onError: () => toast.error('Could not remove the container.'),
    onSettled: () => invalidate(),
  });

  return {
    pendingId: pendingId ?? (removeMutation.isPending ? removeTarget?.id ?? null : null),
    removeTarget,
    removing: removeMutation.isPending,
    openRemoveDialog: (container) => setRemoveTarget(container),
    closeRemoveDialog: () => {
      if (!removeMutation.isPending) setRemoveTarget(null);
    },
    start: (id) => lifecycleMutation.mutate({ id, action: 'start' }),
    stop: (id) => lifecycleMutation.mutate({ id, action: 'stop' }),
    restart: (id) => lifecycleMutation.mutate({ id, action: 'restart' }),
    confirmRemove: (options) => {
      if (!removeTarget) return;
      removeMutation.mutate({ id: removeTarget.id, options });
    },
  };
}
