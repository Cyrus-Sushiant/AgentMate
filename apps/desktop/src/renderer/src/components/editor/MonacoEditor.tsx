import * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { resolveMonacoThemeKey } from './monacoSetup';

function currentMonacoTheme(): string {
  switch (resolveMonacoThemeKey()) {
    case 'light':
      return 'vs';
    case 'dark':
    case 'vscode-dark':
      return 'vs-dark';
    case 'vs2026':
      return 'agentmate-vs2026';
  }
}

export interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  className?: string;
}

export function MonacoEditor({
  value,
  onChange,
  language = 'markdown',
  readOnly = false,
  className,
}: MonacoEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only setup; prop changes are applied via refs/other effects, not by recreating the editor
  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value,
      language,
      theme: currentMonacoTheme(),
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      readOnly,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
    });
    editorRef.current = editor;

    const contentDisposable = editor.onDidChangeModelContent(() => {
      onChangeRef.current?.(editor.getValue());
    });

    const themeObserver = new MutationObserver(() => {
      monaco.editor.setTheme(currentMonacoTheme());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      contentDisposable.dispose();
      themeObserver.disconnect();
      editor.dispose();
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly });
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'min-h-[240px] w-full overflow-hidden rounded-lg border border-border',
        className,
      )}
    />
  );
}
