import type { SkillUsageReport, SkillUsageStat } from '@shared/apiTypes';
import { useMemo, useState } from 'react';
import { ChartSimple, Clock, FolderOpen, RefreshCw, Search, Sparkles } from '@/components/icons';
import { SkillFavoriteButton } from '@/components/skills/SkillFavoriteButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { type SkillFavorites, usageFavoriteInput } from '@/hooks/useSkillFavorites';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

type UsageSort = 'most-used' | 'recent' | 'name';
type UsageView = 'skill' | 'project';

const SORT_OPTIONS: { value: UsageSort; label: string }[] = [
  { value: 'most-used', label: 'Most used' },
  { value: 'recent', label: 'Recently used' },
  { value: 'name', label: 'Name' },
];

/** How many rows to show before the "Show more" button. */
const PAGE_SIZE = 25;

/** Medal tints for the top three, so the busiest skills read at a glance. */
const RANK_STYLES = [
  'bg-amber-400/15 text-amber-500 ring-1 ring-amber-400/30',
  'bg-slate-400/15 text-slate-400 ring-1 ring-slate-400/30',
  'bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/30',
];

function sortStats(stats: SkillUsageStat[], sort: UsageSort): SkillUsageStat[] {
  const sorted = [...stats];
  if (sort === 'name') {
    sorted.sort((a, b) => a.skill.localeCompare(b.skill));
  } else if (sort === 'recent') {
    sorted.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  } else {
    sorted.sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
  }
  return sorted;
}

/** `2026-09-07` as the short date the chart's tooltips and axis show. */
function formatDay(day: string): string {
  const parsed = new Date(`${day}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? day
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The 30-day activity chart. Days with nothing keep a hairline, so the axis stays readable. */
function ActivityChart({ days, counts }: { days: string[]; counts: number[] }): React.JSX.Element {
  const max = Math.max(1, ...counts);
  return (
    <div className="space-y-1.5">
      <div className="flex h-24 items-end gap-[3px]">
        {days.map((day, index) => {
          const count = counts[index] ?? 0;
          return (
            <SimpleTooltip
              key={day}
              label={`${formatDay(day)}: ${count} invocation${count === 1 ? '' : 's'}`}
            >
              <div className="flex h-full flex-1 cursor-default items-end">
                <div
                  className={cn(
                    'w-full rounded-sm transition-colors',
                    count > 0
                      ? 'bg-primary/70 hover:bg-primary'
                      : 'bg-muted hover:bg-muted-foreground/30',
                  )}
                  style={{ height: count > 0 ? `${Math.max((count / max) * 100, 8)}%` : '2px' }}
                />
              </div>
            </SimpleTooltip>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{days.length > 0 ? formatDay(days[0]) : ''}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** One skill's own 30 days, small enough to sit inside a row. */
function MiniTrend({ daily }: { daily: number[] }): React.JSX.Element {
  const max = Math.max(1, ...daily);
  return (
    <div className="hidden h-7 items-end gap-px sm:flex" aria-hidden="true">
      {daily.map((count, index) => (
        <div
          // Fixed-length window: the index is the day, and days never reorder.
          key={index}
          className={cn('w-[3px] rounded-sm', count > 0 ? 'bg-primary/60' : 'bg-muted')}
          style={{ height: count > 0 ? `${Math.max((count / max) * 100, 20)}%` : '2px' }}
        />
      ))}
    </div>
  );
}

/** Totals per project folder, derived from the per-skill breakdowns. */
interface ProjectRollup {
  path: string;
  label: string;
  total: number;
  skills: { skill: string; count: number }[];
}

function rollupByProject(stats: SkillUsageStat[]): ProjectRollup[] {
  const byPath = new Map<string, ProjectRollup>();
  for (const stat of stats) {
    for (const project of stat.projects) {
      const rollup = byPath.get(project.path) ?? {
        path: project.path,
        label: project.label,
        total: 0,
        skills: [],
      };
      rollup.total += project.count;
      rollup.skills.push({ skill: stat.skill, count: project.count });
      byPath.set(project.path, rollup);
    }
  }
  return [...byPath.values()]
    .map((rollup) => ({
      ...rollup,
      skills: rollup.skills.sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill)),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

/**
 * The Usage tab: which skills the agents on this machine actually invoke, and how often. The
 * counts come from the local session transcripts, so they cover every run of the CLI, not only
 * the ones started from AgentMate.
 */
export function SkillUsageTab({
  report,
  isPending,
  isRescanning,
  onRescan,
  favorites,
}: {
  report: SkillUsageReport | undefined;
  isPending: boolean;
  isRescanning: boolean;
  onRescan: () => void;
  favorites: SkillFavorites;
}): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<UsageSort>('most-used');
  const [view, setView] = useState<UsageView>('skill');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const stats = useMemo(() => report?.stats ?? [], [report]);
  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const matching = query
      ? stats.filter(
          (stat) =>
            stat.skill.toLowerCase().includes(query) ||
            stat.projects.some((project) => project.label.toLowerCase().includes(query)),
        )
      : stats;
    return sortStats(matching, sort);
  }, [stats, query, sort]);

  const projects = useMemo(() => {
    const rollups = rollupByProject(stats);
    if (!query) return rollups;
    return rollups
      .map((rollup) => ({
        ...rollup,
        skills: rollup.skills.filter((entry) => entry.skill.toLowerCase().includes(query)),
      }))
      .filter((rollup) => rollup.label.toLowerCase().includes(query) || rollup.skills.length > 0);
  }, [stats, query]);

  const visible = filtered.slice(0, visibleCount);
  // Bar lengths are relative to the busiest skill, so the top row always fills its track.
  const maxCount = stats.reduce((max, stat) => Math.max(max, stat.count), 0);
  const weekTotal = stats.reduce((sum, stat) => sum + stat.count7d, 0);
  const lastUsed = stats.reduce<string | null>(
    (latest, stat) => (!latest || stat.lastUsedAt > latest ? stat.lastUsedAt : latest),
    null,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Counted from the Claude Code session transcripts on this machine, so every skill an agent
          invoked is here, whether the session was started from AgentMate or a terminal. Nothing
          leaves your computer.
        </p>
        <div className="flex items-center gap-2">
          {report && (
            <span className="text-xs text-muted-foreground">
              {report.filesScanned} session{report.filesScanned === 1 ? '' : 's'} read ·{' '}
              {timeAgo(report.scannedAt)}
            </span>
          )}
          <Button variant="outline" size="sm" disabled={isRescanning} onClick={onRescan}>
            <RefreshCw className={cn('h-3.5 w-3.5', isRescanning && 'animate-spin')} />
            Rescan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Skills used"
          value={isPending ? <Skeleton className="h-7 w-16" /> : stats.length}
        />
        <StatTile
          icon={<ChartSimple className="h-3.5 w-3.5" />}
          label="Total invocations"
          value={isPending ? <Skeleton className="h-7 w-16" /> : (report?.totalInvocations ?? 0)}
        />
        <StatTile
          icon={<ChartSimple className="h-3.5 w-3.5" />}
          label="Last 7 days"
          value={isPending ? <Skeleton className="h-7 w-16" /> : weekTotal}
        />
        <StatTile
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Last used"
          value={
            isPending ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <span className="text-lg">{lastUsed ? timeAgo(lastUsed) : '—'}</span>
            )
          }
        />
      </div>

      {isPending && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-[62px] w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isPending && stats.length === 0 && (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <ChartSimple className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">No skill invocations found.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(report?.sourceRoots.length ?? 0) === 0
              ? 'No Claude Code session transcripts on this machine yet.'
              : 'The sessions read so far never invoked a skill. Counts appear here as soon as one does.'}
          </p>
        </div>
      )}

      {!isPending && stats.length > 0 && (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Last 30 days</span>
                <span className="text-xs text-muted-foreground">
                  {(report?.dailyTotals ?? []).reduce((sum, count) => sum + count, 0)} invocations
                </span>
              </div>
              <ActivityChart days={report?.days ?? []} counts={report?.dailyTotals ?? []} />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={view === 'skill' ? 'default' : 'ghost'}
                onClick={() => setView('skill')}
              >
                <Sparkles className="h-3.5 w-3.5" /> By skill
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === 'project' ? 'default' : 'ghost'}
                onClick={() => setView('project')}
              >
                <FolderOpen className="h-3.5 w-3.5" /> By project
              </Button>
            </div>
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search used skills or projects…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
            </div>
            {view === 'skill' && (
              <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                {SORT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={sort === option.value ? 'default' : 'ghost'}
                    onClick={() => setSort(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {view === 'skill' && (
            <div className="space-y-2">
              {visible.map((stat, index) => {
                const share = maxCount > 0 ? Math.round((stat.count / maxCount) * 100) : 0;
                const ranked = sort === 'most-used' && !query;
                return (
                  <div
                    key={stat.skill}
                    className="group rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                          ranked && index < 3
                            ? RANK_STYLES[index]
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {ranked ? index + 1 : '·'}
                      </span>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {stat.skill}
                          </span>
                          {stat.count7d > 0 && (
                            <Badge variant="secondary">{stat.count7d} this week</Badge>
                          )}
                          {stat.projects.slice(0, 2).map((project) => (
                            <SimpleTooltip key={project.path} label={project.path}>
                              <Badge variant="outline">
                                {project.label} · {project.count}
                              </Badge>
                            </SimpleTooltip>
                          ))}
                          {stat.projects.length > 2 && (
                            <Badge variant="outline">+{stat.projects.length - 2} more</Badge>
                          )}
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all group-hover:bg-primary"
                            style={{ width: `${Math.max(share, 2)}%` }}
                          />
                        </div>
                      </div>

                      <MiniTrend daily={stat.daily} />

                      <div className="w-16 shrink-0 text-right">
                        <div className="text-base font-semibold tabular-nums text-foreground">
                          {stat.count}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {timeAgo(stat.lastUsedAt)}
                        </div>
                      </div>

                      <SkillFavoriteButton
                        starred={favorites.isFavorite(stat.skill)}
                        onToggle={() => favorites.toggleFavorite(usageFavoriteInput(stat.skill))}
                        className="shrink-0"
                      />
                    </div>
                  </div>
                );
              })}

              {filtered.length > visible.length && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  >
                    Show more ({filtered.length - visible.length} remaining)
                  </Button>
                </div>
              )}

              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No used skills match your search.</p>
              )}
            </div>
          )}

          {view === 'project' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {projects.map((project) => {
                const topCount = project.skills[0]?.count ?? 1;
                return (
                  <Card key={project.path}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {project.label}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{project.path}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {project.total} use{project.total === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        {project.skills.map((entry) => (
                          <div key={entry.skill} className="flex items-center gap-2">
                            <span className="w-40 shrink-0 truncate text-xs text-foreground">
                              {entry.skill}
                            </span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/70"
                                style={{
                                  width: `${Math.max((entry.count / topCount) * 100, 4)}%`,
                                }}
                              />
                            </div>
                            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {entry.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {query
                    ? 'No projects match your search.'
                    : 'The sessions read carry no project folder, so there is nothing to group.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
