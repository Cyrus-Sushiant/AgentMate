import * as monaco from 'monaco-editor';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';
import { resolveMonacoThemeKey } from './monacoSetup';

export interface MonacoDiffEditorHandle {
  goToChange: (direction: 'next' | 'previous') => void;
}

export interface MonacoDiffEditorProps {
  /** Picks the syntax highlighting; a new path also resets the view to the top. */
  path: string;
  original: string;
  modified: string;
  sideBySide: boolean;
  ignoreWhitespace: boolean;
  /** Lets the user edit the modified side. The original side always stays read-only. */
  editable?: boolean;
  /** Called with the modified side's text after each edit the user makes. */
  onModifiedChange?: (value: string) => void;
  className?: string;
}

function currentTheme(): string {
  switch (resolveMonacoThemeKey()) {
    case 'light':
      return 'agentmate-light';
    case 'dark':
      return 'agentmate-dark';
    case 'vscode-dark':
      return 'vs-dark';
    case 'vs2026':
      return 'agentmate-vs2026';
  }
}

/** Monaco's language id for a file, from its extension or exact name. */
export function languageFor(path: string): string {
  const name = path.split('/').pop()?.toLowerCase() ?? '';
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot) : '';
  for (const language of monaco.languages.getLanguages()) {
    if (language.filenames?.some((f) => f.toLowerCase() === name)) return language.id;
    if (ext && language.extensions?.includes(ext)) return language.id;
  }
  return 'plaintext';
}

/** A side-by-side (or inline) diff of two versions of a file, optionally editable on the right. */
export const MonacoDiffEditor = forwardRef<MonacoDiffEditorHandle, MonacoDiffEditorProps>(
  function MonacoDiffEditor(
    {
      path,
      original,
      modified,
      sideBySide,
      ignoreWhitespace,
      editable = false,
      onModifiedChange,
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const onModifiedChangeRef = useRef(onModifiedChange);
    onModifiedChangeRef.current = onModifiedChange;
    // Set while new content from outside is loaded, so only the user's own edits are reported.
    const applyingRef = useRef(false);
    const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
    const modelsRef = useRef<{
      path: string;
      original: monaco.editor.ITextModel;
      modified: monaco.editor.ITextModel;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      goToChange: (direction) => editorRef.current?.goToDiff(direction),
    }));

    // biome-ignore lint/correctness/useExhaustiveDependencies: created once; option and content changes are applied by the effects below
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const editor = monaco.editor.createDiffEditor(container, {
        theme: currentTheme(),
        readOnly: !editable,
        originalEditable: false,
        automaticLayout: true,
        renderSideBySide: sideBySide,
        useInlineViewWhenSpaceIsLimited: true,
        renderSideBySideInlineBreakpoint: 700,
        ignoreTrimWhitespace: ignoreWhitespace,
        hideUnchangedRegions: { enabled: true, contextLineCount: 4, minimumLineCount: 6 },
        renderOverviewRuler: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12.5,
        lineHeight: 19,
        fontFamily:
          "'Cascadia Code', 'Cascadia Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        renderLineHighlight: 'none',
        stickyScroll: { enabled: false },
        padding: { top: 8 },
        diffAlgorithm: 'advanced',
      });
      editorRef.current = editor;

      // Listens on the editor, not a model, so it keeps working when the file is swapped.
      const modifiedEditor = editor.getModifiedEditor();
      const contentListener = modifiedEditor.onDidChangeModelContent(() => {
        if (applyingRef.current) return;
        onModifiedChangeRef.current?.(modifiedEditor.getValue());
      });

      const themeObserver = new MutationObserver(() => monaco.editor.setTheme(currentTheme()));
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      return () => {
        themeObserver.disconnect();
        contentListener.dispose();
        editor.dispose();
        // Models outlive the editor in Monaco's registry; leaving them is how diffs leak.
        modelsRef.current?.original.dispose();
        modelsRef.current?.modified.dispose();
        modelsRef.current = null;
        editorRef.current = null;
      };
    }, []);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const current = modelsRef.current;
      if (current && current.path === path) {
        // Same file, new content (it changed on disk): keep the scroll position.
        applyingRef.current = true;
        try {
          if (current.original.getValue() !== original) current.original.setValue(original);
          if (current.modified.getValue() !== modified) current.modified.setValue(modified);
        } finally {
          applyingRef.current = false;
        }
        return;
      }
      const language = languageFor(path);
      const next = {
        path,
        original: monaco.editor.createModel(original, language),
        modified: monaco.editor.createModel(modified, language),
      };
      applyingRef.current = true;
      try {
        editor.setModel({ original: next.original, modified: next.modified });
      } finally {
        applyingRef.current = false;
      }
      current?.original.dispose();
      current?.modified.dispose();
      modelsRef.current = next;
    }, [path, original, modified]);

    useEffect(() => {
      editorRef.current?.updateOptions({
        renderSideBySide: sideBySide,
        ignoreTrimWhitespace: ignoreWhitespace,
        readOnly: !editable,
      });
    }, [sideBySide, ignoreWhitespace, editable]);

    return <div ref={containerRef} className={cn('h-full w-full overflow-hidden', className)} />;
  },
);
