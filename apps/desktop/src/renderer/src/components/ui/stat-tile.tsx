import { Card, CardContent } from '@/components/ui/card';

export function StatTile({
  icon,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  /** A skeleton stands in here until the data lands. */
  value: React.ReactNode;
  /** Optional control (e.g. a refresh button) pinned to the top-right corner. */
  action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card className="glass">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon} {label}
          {action && <span className="ml-auto">{action}</span>}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
