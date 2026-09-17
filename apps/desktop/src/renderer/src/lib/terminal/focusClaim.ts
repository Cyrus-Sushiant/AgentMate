/**
 * Opening a terminal should leave the keyboard in it. Focusing it once is not enough: the menu or
 * dialog that launched it still holds focus at that moment (a modal traps it and pulls it back),
 * and once it closes it hands focus to the page, or to whatever had it before, often another
 * terminal. The user then had to click into the new terminal before typing.
 *
 * So for a short while after a terminal asks for focus, it takes focus back whenever focus is
 * anywhere else, including the Run button that was just clicked or the trigger a closing menu
 * returns focus to. Any click or Tab ends that early, since that is the user moving on purpose.
 */

export interface FocusClaimTarget {
  /** The element the terminal renders in. Focus already inside it is left alone. */
  element: HTMLElement;
  /** False while the terminal cannot take focus (not opened yet, off screen, disposed). */
  canFocus: () => boolean;
  focus: () => void;
}

const CLAIM_MS = 2000;
/** How long a terminal that cannot take focus yet is waited for. */
const OPEN_WAIT_MS = 10_000;

let current: { target: FocusClaimTarget; until: number; frame: number; started: boolean } | null =
  null;

function focusIsLost(target: FocusClaimTarget): boolean {
  const active = document.activeElement;
  if (!active || !active.isConnected) return true;
  return !target.element.contains(active);
}

function endClaim(): void {
  if (!current) return;
  cancelAnimationFrame(current.frame);
  current = null;
  window.removeEventListener('pointerdown', endClaim, true);
  window.removeEventListener('keydown', endClaimOnTab, true);
}

function endClaimOnTab(event: KeyboardEvent): void {
  if (event.key === 'Tab') endClaim();
}

export function claimTerminalFocus(target: FocusClaimTarget): void {
  endClaim();
  // The window starts once the terminal can take focus: a drawer still loading or a terminal
  // still waiting on its font should not use it up.
  const claim = { target, until: Date.now() + OPEN_WAIT_MS, frame: 0, started: false };
  current = claim;
  window.addEventListener('pointerdown', endClaim, true);
  window.addEventListener('keydown', endClaimOnTab, true);
  const tick = (): void => {
    if (current !== claim) return;
    const now = Date.now();
    if (now > claim.until) {
      endClaim();
      return;
    }
    if (target.canFocus()) {
      if (!claim.started) {
        claim.started = true;
        claim.until = now + CLAIM_MS;
      }
      if (focusIsLost(target)) target.focus();
    }
    claim.frame = requestAnimationFrame(tick);
  };
  tick();
}

/** Drops the claim if it belongs to this element, e.g. its terminal was disposed. */
export function releaseTerminalFocus(element: HTMLElement): void {
  if (current?.target.element === element) endClaim();
}
