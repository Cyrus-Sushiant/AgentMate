import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, FolderPlus, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { WordPressMark } from '@/components/wordpress/WordPressMark';
import { cn } from '@/lib/utils';
import { NewWordPressProjectDialog } from './NewWordPressProjectDialog';

/**
 * The Projects page's New Project button (E21): the button itself starts an empty project, and
 * the arrow next to it offers the other kinds, a WordPress site for now. `?new=wordpress` opens
 * the WordPress flow straight away.
 */
export function NewProjectButton({
  onNewEmpty,
  className,
}: {
  onNewEmpty: () => void;
  className?: string;
}): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [wordpressOpen, setWordpressOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') !== 'wordpress') return;
    setWordpressOpen(true);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('new');
        return params;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  return (
    <>
      <div className={cn('flex items-center', className)}>
        <Button className="rounded-l-full rounded-r-none pl-4 pr-3" onClick={onNewEmpty}>
          <Plus /> New Project
        </Button>
        <DropdownMenu>
          <SimpleTooltip label="More kinds of project">
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="More kinds of project"
                className="rounded-l-none rounded-r-full border-l border-primary-foreground/20 px-2.5"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
          </SimpleTooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onNewEmpty}>
              <FolderPlus className="h-4 w-4" /> Empty project
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setWordpressOpen(true)}>
              <WordPressMark className="h-4 w-4" /> WordPress site
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <NewWordPressProjectDialog open={wordpressOpen} onOpenChange={setWordpressOpen} />
    </>
  );
}
