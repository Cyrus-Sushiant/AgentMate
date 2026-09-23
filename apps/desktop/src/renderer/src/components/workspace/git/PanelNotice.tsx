import { Github } from '@/components/icons';

/** The centred message a panel tab shows when it has nothing to list, with an optional way out. */
export function PanelNotice({
  title,
  body,
  action,
  icon: Icon = Github,
}: {
  title: string;
  body: React.ReactNode;
  action?: { label: string; run: () => void };
  icon?: React.ComponentType<{ className?: string }>;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-1.5 px-5 py-5 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="text-xs font-medium">{title}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{body}</p>
      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="mt-1 text-[11px] font-medium text-primary hover:underline"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
