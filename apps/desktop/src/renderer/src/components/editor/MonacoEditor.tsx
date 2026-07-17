import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import './monacoSetup';
import { cn } from '@/lib/utils';

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
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

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value,
      language,
      theme: isDarkMode() ? 'vs-dark' : 'vs',
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
      monaco.editor.setTheme(isDarkMode() ? 'vs-dark' : 'vs');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
