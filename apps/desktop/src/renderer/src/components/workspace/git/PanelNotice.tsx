import { Github } from '@/components/icons';
import { EmptyState } from '@/components/pageKit';
import { Button } from '@/components/ui/button';

/**
 * What a panel tab or section shows when it has nothing to list: the glowing empty state, sized
 * for the narrow panel, with an optional way out.
 */
export function PanelNotice({
  title,
  body,
  action,
  icon = Github,
}: {
  title: string;
  body: React.ReactNode;
  action?: { label: string; run: () => void };
  icon?: React.ComponentType<{ className?: string }>;
}): React.JSX.Element {
  return (
    <EmptyState
      size="sm"
      icon={icon}
      title={title}
      description={<span className="block text-xs">{body}</span>}
      action={
        action ? (
          <Button type="button" variant="soft" size="xs" onClick={action.run}>
            {action.label}
          </Button>
        ) : undefined
      }
      className="gap-2.5 px-4 py-5"
    />
  );
}
