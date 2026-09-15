import { quoteAllForShell, shellKindFor } from '@agentmat/core';

/**
 * Pasting into a terminal the way an agent CLI wants it: text goes in as text (xterm handles
 * that), while an image or a copied file goes in as a quoted path. Agents such as Claude Code
 * and Codex attach an image when given its path, which is how a pasted screenshot reaches them.
 */

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp']);

/** A path for each pasted file: its own on disk, or a saved copy for clipboard-only images. */
async function pathsForFiles(files: File[]): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const onDisk = window.agentmat.shell.pathForFile(file);
    if (onDisk) {
      paths.push(onDisk);
      continue;
    }
    if (IMAGE_TYPES.has(file.type)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      paths.push(await window.agentmat.terminalClipboard.saveImage(bytes, file.type));
    }
  }
  return paths;
}

export function pastePathsText(paths: string[], shell: string | undefined): string {
  return `${quoteAllForShell(paths, shellKindFor(shell, window.agentmat.platform))} `;
}

/**
 * Catches pastes that carry files (a screenshot, files copied in Explorer or Finder) before
 * xterm turns them into nothing, and pastes their paths instead. Returns a cleanup.
 */
export function attachFilePaste(
  element: HTMLElement,
  shell: () => string | undefined,
  paste: (text: string) => void,
): () => void {
  const onPaste = (event: ClipboardEvent): void => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    // Text copied from a web page can come with an image of itself; the text is what was meant.
    if (event.clipboardData?.getData('text/plain')) return;
    event.preventDefault();
    event.stopPropagation();
    void pathsForFiles(files).then((paths) => {
      if (paths.length > 0) paste(pastePathsText(paths, shell()));
    });
  };
  // Capture phase: xterm listens on its own textarea further down.
  element.addEventListener('paste', onPaste, true);
  return () => element.removeEventListener('paste', onPaste, true);
}

/** For right-click paste, which reads the clipboard itself: an image or copied file as paths. */
export async function readClipboardPaths(): Promise<string[] | null> {
  const special = await window.agentmat.terminalClipboard.readSpecial().catch(() => null);
  return special?.paths.length ? special.paths : null;
}
