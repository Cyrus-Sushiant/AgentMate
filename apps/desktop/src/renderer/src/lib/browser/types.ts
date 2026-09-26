/**
 * What the element picker (guest/picker.js) reports about a page element, and the comments the
 * user leaves on one. The picker builds these objects inside the page, so they have to stay plain
 * JSON: strings, numbers, booleans, arrays and records.
 */

export interface PickRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PickedPage {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  dpr: number;
}

export interface PickedElement {
  tagName: string;
  /** A CSS selector that matches only this element when it was picked. */
  selector: string;
  /** A short readable trail such as `main > form.signup > button.save`. */
  path: string;
  role: string | null;
  /** The accessible name: aria-label, aria-labelledby, alt or the element's own text. */
  name: string | null;
  text: string;
  html: string;
  attributes: Record<string, string>;
  styles: Record<string, string>;
  /** React component names from the element outwards, and the JSX source when React exposes it. */
  react: { components: string[]; source: string | null } | null;
  rectViewport: PickRect;
  rectPage: PickRect;
  /** The element or one of its ancestors is position: fixed, so it doesn't scroll with the page. */
  fixed: boolean;
}

export interface PickPayload {
  page: PickedPage;
  element: PickedElement;
}

/** How awaitPick() in the page settles. `copy` is a right-click, or any pick in copy mode. */
export type PickResult =
  | { kind: 'pick'; payload: PickPayload }
  | { kind: 'copy'; payload: PickPayload }
  | { kind: 'cancel' };

export type AnnotationIntent = 'change' | 'fix' | 'question';

export interface BrowserAnnotation {
  id: string;
  tabId: string;
  page: PickedPage;
  element: PickedElement;
  comment: string;
  intent: AnnotationIntent;
  /** The device preset the page was shown at, when it wasn't the responsive fill. */
  preset: string | null;
  screenshotPath: string | null;
  thumbDataUrl: string | null;
  createdAt: number;
}

/** A numbered pin the picker draws on the page for a comment. */
export interface PageMarker {
  n: number;
  id: string;
  rectPage: PickRect;
  rectViewport: PickRect;
  fixed: boolean;
}
