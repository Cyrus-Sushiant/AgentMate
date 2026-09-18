/**
 * Monaco stub. The real editor needs web workers, layout measurement and canvas, none of which
 * jsdom has. Components under test only need the editor to mount and report its value.
 */

interface Listener {
  dispose: () => void;
}

function listener(): Listener {
  return { dispose: () => undefined };
}

class FakeModel {
  constructor(private value: string) {}
  getValue(): string {
    return this.value;
  }
  setValue(next: string): void {
    this.value = next;
  }
  onDidChangeContent(): Listener {
    return listener();
  }
  dispose(): void {
    return undefined;
  }
  getLineCount(): number {
    return this.value.split('\n').length;
  }
  uri = { path: '/test-model' };
}

class FakeEditor {
  private model: FakeModel;

  constructor(
    readonly container: HTMLElement,
    options: { value?: string } = {},
  ) {
    this.model = new FakeModel(options.value ?? '');
    // Something visible in the DOM makes editor tests assertable.
    const area = document.createElement('textarea');
    area.setAttribute('data-testid', 'monaco-editor');
    area.value = this.model.getValue();
    container.appendChild(area);
  }

  getValue(): string {
    return this.model.getValue();
  }
  setValue(next: string): void {
    this.model.setValue(next);
  }
  getModel(): FakeModel {
    return this.model;
  }
  setModel(model: FakeModel): void {
    this.model = model;
  }
  onDidChangeModelContent(): Listener {
    return listener();
  }
  onDidBlurEditorWidget(): Listener {
    return listener();
  }
  onDidFocusEditorWidget(): Listener {
    return listener();
  }
  updateOptions(): void {
    return undefined;
  }
  layout(): void {
    return undefined;
  }
  focus(): void {
    return undefined;
  }
  dispose(): void {
    return undefined;
  }
  addCommand(): void {
    return undefined;
  }
  addAction(): void {
    return undefined;
  }
  getAction() {
    return { run: async () => undefined };
  }
  revealLine(): void {
    return undefined;
  }
  setPosition(): void {
    return undefined;
  }
  getSelection() {
    return null;
  }
  executeEdits(): boolean {
    return true;
  }
  getOriginalEditor(): FakeEditor {
    return this;
  }
  getModifiedEditor(): FakeEditor {
    return this;
  }
}

export const editor = {
  create: (container: HTMLElement, options: { value?: string } = {}) =>
    new FakeEditor(container, options),
  createDiffEditor: (container: HTMLElement) => new FakeEditor(container),
  createModel: (value: string) => new FakeModel(value),
  getModels: () => [] as FakeModel[],
  setModelLanguage: () => undefined,
  defineTheme: () => undefined,
  setTheme: () => undefined,
  EditorOption: {},
};

export const languages = {
  register: () => undefined,
  setMonarchTokensProvider: () => undefined,
  setLanguageConfiguration: () => undefined,
  registerCompletionItemProvider: () => listener(),
  typescript: {
    typescriptDefaults: {
      setCompilerOptions: () => undefined,
      setDiagnosticsOptions: () => undefined,
    },
    javascriptDefaults: {
      setCompilerOptions: () => undefined,
      setDiagnosticsOptions: () => undefined,
    },
    ScriptTarget: { ESNext: 99 },
  },
  json: { jsonDefaults: { setDiagnosticsOptions: () => undefined } },
  CompletionItemKind: { Snippet: 27, Text: 18 },
  CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
};

export const KeyMod = { CtrlCmd: 2048, Shift: 1024, Alt: 512, WinCtrl: 256 };
export const KeyCode = { Enter: 3, KeyS: 49, KeyK: 41, Escape: 9 };
export const Uri = {
  parse: (value: string) => ({ path: value, toString: () => value }),
  file: (value: string) => ({ path: value, toString: () => value }),
};
export class Range {
  constructor(
    readonly startLineNumber: number,
    readonly startColumn: number,
    readonly endLineNumber: number,
    readonly endColumn: number,
  ) {}
}
export const MarkerSeverity = { Error: 8, Warning: 4, Info: 2, Hint: 1 };

export default { editor, languages, KeyMod, KeyCode, Uri, Range, MarkerSeverity };
