/**
 * A one-line snippet typed into a freshly spawned shell so it reports, on its own, whenever a
 * fresh prompt is ready for input. The terminal renderer listens for that marker (an OSC 7750
 * sequence) to know it can safely take over the current input line, e.g. to show a pasted file
 * as a short chip instead of its whole path. Each snippet chains onto whatever prompt hook the
 * shell (or the user's own dotfiles, or a prompt framework like Starship) already has, rather
 * than replacing it, so a custom prompt keeps working exactly as it did before.
 */

const MARKER = '\\033]7750;AgentMate:PromptReady:1\\007';

function basename(shell: string): string {
  return shell.toLowerCase().replace(/\\/g, '/').split('/').pop() ?? '';
}

function bashSnippet(): string {
  return `PROMPT_COMMAND="\${PROMPT_COMMAND:+$PROMPT_COMMAND$'\\n'}printf '${MARKER}'"\r`;
}

function zshSnippet(): string {
  return (
    '(( ${+precmd_functions} )) || typeset -ga precmd_functions; ' +
    `agentmate_precmd() { printf '${MARKER}' }; precmd_functions+=(agentmate_precmd)\r`
  );
}

function fishSnippet(): string {
  return `function __agentmate_marker --on-event fish_prompt; printf '${MARKER}'; end\r`;
}

// The marker is written as a side effect and the original prompt's own return value is passed
// straight through, which is the only arrangement that satisfies both constraints here.
// Returning '' and writing the prompt text by hand tells PSReadLine the prompt is 0 columns
// wide and desyncs every redraw. Appending the marker to the returned string instead puts it
// in the string PSReadLine re-renders on each redraw, so it fires again at whatever column the
// cursor happens to be at. Writing it here fires it once, when the prompt is really drawn.
function powershellSnippet(): string {
  return (
    '$global:__agentmatePrevPrompt = $function:prompt; ' +
    'function prompt { ' +
    'Write-Host -NoNewline "$([char]27)]7750;AgentMate:PromptReady:1$([char]7)"; ' +
    '& $global:__agentmatePrevPrompt ' +
    '}\r'
  );
}

/** No raw ESC/BEL bytes here: `$E` is cmd's own macro, expanded when the prompt is drawn, not
 * when this line is "typed" into the shell. Terminated with ST (`$E\`) since cmd has no BEL
 * macro. Existing `PROMPT` (the user's own, or cmd's `$P$G` default) is kept, just prefixed. */
function cmdSnippet(existingPrompt: string): string {
  return `set PROMPT=$E]7750;AgentMate:PromptReady:1$E\\${existingPrompt}\r`;
}

/**
 * The snippet for this shell, or null when the shell has no reliable prompt hook (plain `sh`) or
 * isn't recognized. Null means the shell simply never emits the marker, which is a safe no-op:
 * whatever depends on it just stays off, exactly like it does for an SSH session today.
 */
export function buildPromptMarkerScript(
  shell: string,
  platform: NodeJS.Platform,
  env: Record<string, string> | undefined,
): string | null {
  const name = basename(shell);
  if (name === 'bash') return bashSnippet();
  if (name === 'zsh') return zshSnippet();
  if (name === 'fish') return fishSnippet();
  if (
    name === 'powershell.exe' ||
    name === 'pwsh.exe' ||
    name === 'pwsh' ||
    name === 'powershell'
  ) {
    return powershellSnippet();
  }
  if (name === 'cmd.exe' || name === 'cmd') {
    return cmdSnippet(env?.PROMPT ?? process.env.PROMPT ?? '$P$G');
  }
  if (platform === 'win32' && name === '') return powershellSnippet();
  return null;
}
