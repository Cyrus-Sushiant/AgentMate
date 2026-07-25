import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { File, Folder, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { cn } from '@/lib/utils';

function parentOf(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : path.slice(0, idx);
}

function languageFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md':
      return 'markdown';
    case 'json':
      return 'json';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    default:
      return 'plaintext';
  }
}

export interface ProjectFileBrowserProps {
  rootPath: string;
  /** Bump to jump back to the root and refetch — e.g. after bootstrapping. */
  revision?: number;
}

export function ProjectFileBrowser({
  rootPath,
  revision = 0,
}: ProjectFileBrowserProps): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [dirty, setDirty] = useState(false);

  // `currentPath` seeds from a prop, so it has to resync when the project
  // changes or when new files land underneath us.
  useEffect(() => {
    setCurrentPath(rootPath);
  }, [rootPath, revision]);

  const dirQuery = useQuery({
    queryKey: ['project-dir', currentPath],
    queryFn: () => window.agentmat.fs.listDirectory(currentPath),
  });

  const entries = dirQuery.data ?? [];
  const relativePath = currentPath.slice(rootPath.length).replace(/^[\\/]/, '');

  async function openFile(path: string): Promise<void> {
    try {
      const content = await window.agentmat.fs.readFile(path);
      setSelectedFile(path);
      setFileContent(content);
      setDirty(false);
    } catch (error) {
      toast.error(`Could not open file: ${(error as Error).message}`);
    }
  }

  async function saveFile(): Promise<void> {
    if (!selectedFile) return;
    try {
      await window.agentmat.fs.writeFile(selectedFile, fileContent);
      setDirty(false);
      toast.success('File saved.');
    } catch (error) {
      toast.error(`Could not save file: ${(error as Error).message}`);
    }
  }

  return (
    <div className="flex gap-4">
      <div className="w-56 shrink-0 space-y-0.5">
        <div className="mb-1 flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium" title={currentPath}>
            {relativePath || '/'}
          </span>
          <button
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
            title="Refresh"
            onClick={() => void dirQuery.refetch()}
          >
            <RefreshCw className={cn('h-3 w-3', dirQuery.isFetching && 'animate-spin')} />
          </button>
        </div>
        {currentPath !== rootPath && (
          <button
            className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
            onClick={() => setCurrentPath(parentOf(currentPath))}
          >
            .. up
          </button>
        )}
        {dirQuery.isPending && <p className="px-2 py-1 text-xs text-muted-foreground">Loading…</p>}
        {dirQuery.isError && (
          <div className="space-y-1 px-2 py-1">
            <p className="text-xs text-destructive">
              {(dirQuery.error as Error).message || 'Could not read this folder.'}
            </p>
            <button
              className="rounded text-xs text-muted-foreground underline hover:bg-accent"
              onClick={() => void dirQuery.refetch()}
            >
              Try again
            </button>
          </div>
        )}
        {dirQuery.isSuccess && entries.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">This folder is empty.</p>
        )}
        {entries.map((entry) => (
          <button
            key={entry.path}
            onClick={() => (entry.isDirectory ? setCurrentPath(entry.path) : void openFile(entry.path))}
            className={cn(
              'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-accent',
              selectedFile === entry.path && 'bg-accent',
            )}
          >
            {entry.isDirectory ? (
              <Folder className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <File className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{entry.name}</span>
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        {selectedFile ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="truncate text-xs text-muted-foreground">{selectedFile}</span>
              <Button size="sm" disabled={!dirty} onClick={() => void saveFile()}>
                Save
              </Button>
            </div>
            <MonacoEditor
              value={fileContent}
              language={languageFor(selectedFile)}
              onChange={(value) => {
                setFileContent(value);
                setDirty(true);
              }}
              className="min-h-[360px]"
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a file to edit.</p>
        )}
      </div>
    </div>
  );
}
