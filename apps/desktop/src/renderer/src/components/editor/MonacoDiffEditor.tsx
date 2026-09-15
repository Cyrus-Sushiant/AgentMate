import * as monaco from 'monaco-editor';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import './monacoSetup';
import { cn } from '@/lib/utils';

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
  className?: string;
}

let themesDefined = false;

/** Monaco themes that sit on the app's own surfaces instead of VS Code's grey. */
function defineThemes(): void {
  if (themesDefined) return;
  themesDefined = true;
  monaco.editor.defineTheme('agentmate-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0b0d0c',
      'editorGutter.background': '#0b0d0c',
      'editor.lineHighlightBackground': '#ffffff08',
      'editorLineNumber.foreground': '#4b524e',
      'editorLineNumber.activeForeground': '#9aa39e',
      'diffEditor.insertedTextBackground': '#00e57222',
      'diffEditor.removedTextBackground': '#f0717826',
      'diffEditor.insertedLineBackground': '#00e57212',
      'diffEditor.removedLineBackground': '#f0717814',
      'diffEditorGutter.insertedLineBackground': '#00e5721c',
      'diffEditorGutter.removedLineBackground': '#f071781f',
      'diffEditor.unchangedRegionBackground': '#121514',
      'diffEditor.border': '#ffffff10',
      'scrollbarSlider.background': '#ffffff12',
      'scrollbarSlider.hoverBackground': '#ffffff22',
      'scrollbarSlider.activeBackground': '#00e57240',
    },
  });
  monaco.editor.defineTheme('agentmate-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#fbfbfb',
      'editorGutter.background': '#fbfbfb',
      'diffEditor.insertedTextBackground': '#00994d24',
      'diffEditor.removedTextBackground': '#d9363e24',
      'diffEditor.insertedLineBackground': '#00994d10',
      'diffEditor.removedLineBackground': '#d9363e10',
      'diffEditor.unchangedRegionBackground': '#f0f0f0',
    },
  });
}

function currentTheme(): string {
  return document.documentElement.classList.contains('dark') ? 'agentmate-dark' : 'agentmate-light';
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

/** A read-only side-by-side (or inline) diff of two versions of a file. */
export const MonacoDiffEditor = forwardRef<MonacoDiffEditorHandle, MonacoDiffEditorProps>(
  function MonacoDiffEditor(
    { path, original, modified, sideBySide, ignoreWhitespace, className },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
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
      defineThemes();
      const editor = monaco.editor.createDiffEditor(container, {
        theme: currentTheme(),
        readOnly: true,
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

      const themeObserver = new MutationObserver(() => monaco.editor.setTheme(currentTheme()));
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      return () => {
        themeObserver.disconnect();
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
        if (current.original.getValue() !== original) current.original.setValue(original);
        if (current.modified.getValue() !== modified) current.modified.setValue(modified);
        return;
      }
      const language = languageFor(path);
      const next = {
        path,
        original: monaco.editor.createModel(original, language),
        modified: monaco.editor.createModel(modified, language),
      };
      editor.setModel({ original: next.original, modified: next.modified });
      current?.original.dispose();
      current?.modified.dispose();
      modelsRef.current = next;
    }, [path, original, modified]);

    useEffect(() => {
      editorRef.current?.updateOptions({
        renderSideBySide: sideBySide,
        ignoreTrimWhitespace: ignoreWhitespace,
      });
    }, [sideBySide, ignoreWhitespace]);

    return <div ref={containerRef} className={cn('h-full w-full overflow-hidden', className)} />;
  },
);
