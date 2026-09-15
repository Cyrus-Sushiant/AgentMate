import { CLI_REGISTRY, type CliDefinition, type Project } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import { projectCliId } from '@/lib/workspace/launch';
import { useCliStore } from '@/stores/cliStore';

export interface AgentChoice {
  cli: CliDefinition;
  installed: boolean;
  isDefault: boolean;
}

export interface AgentChoices {
  /** Installed agents, in the user's order (or the project's own first when none is set). */
  installed: AgentChoice[];
  /** Agents that are not on this machine, for a gentle "install" nudge. */
  missing: AgentChoice[];
  loading: boolean;
}

/**
 * Registry CLIs in the user's chosen order. Ids the order doesn't mention (a CLI added in a
 * later release) keep their registry position after the ordered ones.
 */
export function orderedClis(order: readonly string[]): CliDefinition[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return CLI_REGISTRY.map((cli, index) => ({ cli, index }))
    .sort(
      (a, b) =>
        (rank.get(a.cli.id) ?? order.length + a.index) -
        (rank.get(b.cli.id) ?? order.length + b.index),
    )
    .map(({ cli }) => cli);
}

/** The agent CLIs a workspace can launch, split by whether they are installed. */
export function useAgentChoices(project: Project | null): AgentChoices {
  // Re-read when the app default changes so the highlighted tile follows it.
  useCliStore((s) => s.defaultCliId);
  const cliOrder = useCliStore((s) => s.cliOrder);
  const status = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
    staleTime: 5 * 60_000,
  });
  const defaultId = project ? projectCliId(project) : null;
  const loading = status.isPending;
  return useMemo(() => {
    const installedIds = new Set((status.data ?? []).filter((c) => c.installed).map((c) => c.id));
    const choices = orderedClis(cliOrder).map((cli) => ({
      cli,
      installed: installedIds.has(cli.id),
      isDefault: cli.id === defaultId,
    }));
    // With no order of their own, the project's agent leads; a chosen order is kept as is.
    const byDefault = (a: AgentChoice, b: AgentChoice): number =>
      cliOrder.length > 0 ? 0 : Number(b.isDefault) - Number(a.isDefault);
    return {
      installed: choices.filter((c) => c.installed).sort(byDefault),
      missing: choices.filter((c) => !c.installed).sort(byDefault),
      loading,
    };
  }, [status.data, defaultId, loading, cliOrder]);
}
