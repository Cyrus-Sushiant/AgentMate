import { type IpcMainInvokeEvent, ipcMain } from 'electron';
import type {
  RdpAgentFrame,
  RdpAgentRequest,
  RdpAgentResponse,
  RdpInputOp,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { sendToWindow } from '../ipc/send';
import { createPendingRequests } from './pendingRequests';
import { getRdpWindow } from './sessionWindows';

/**
 * How an AI task sees and drives a Remote Desktop session. Only the session's window holds the
 * IronRDP connection, so main asks it for a screenshot or to apply input and waits for the answer.
 */

/** Reading the canvas and encoding a PNG takes well under a second; this is for a stuck window. */
const FRAME_TIMEOUT_MS = 10_000;
/** Applying input is near instant, apart from the pauses a double click or drag asks for. */
const INPUT_TIMEOUT_MS = 5_000;
const WINDOW_CLOSED = 'The Remote Desktop window is closed.';

const pending = createPendingRequests();

type RequestBody = { kind: 'frame'; maxWidth: number } | { kind: 'input'; ops: RdpInputOp[] };

function send<T>(sessionId: string, body: RequestBody, timeoutMs: number): Promise<T> {
  return pending.request<T>(
    sessionId,
    (requestId) => {
      const window = getRdpWindow(sessionId);
      if (!window) throw new Error(WINDOW_CLOSED);
      const request: RdpAgentRequest = { requestId, sessionId, ...body };
      sendToWindow(window, IPC.rdpAgent.onRequest, request);
    },
    timeoutMs,
  );
}

/** A screenshot of the session, scaled down to at most `maxWidth` pixels wide. */
export async function requestRdpFrame(sessionId: string, maxWidth = 1280): Promise<RdpAgentFrame> {
  const frame = await send<RdpAgentFrame | undefined>(
    sessionId,
    { kind: 'frame', maxWidth },
    FRAME_TIMEOUT_MS,
  );
  if (!frame) throw new Error('The Remote Desktop window sent no screenshot.');
  return frame;
}

/** Resolves once the session window has applied every op. */
export async function requestRdpInput(sessionId: string, ops: RdpInputOp[]): Promise<void> {
  const pauses = ops.reduce((total, op) => total + (op.kind === 'pause' ? op.ms : 0), 0);
  await send<void>(sessionId, { kind: 'input', ops }, INPUT_TIMEOUT_MS + pauses);
}

/** Fails whatever the session still waits on, e.g. when its task stops or its window closes. */
export function dropRdpAgentRequests(sessionId: string): void {
  pending.rejectAll(sessionId, WINDOW_CLOSED);
}

/** Called once, from registerRdpAgentHandlers. */
export function registerRdpAgentBridgeHandlers(): void {
  ipcMain.handle(
    IPC.rdpAgent.respond,
    (event: IpcMainInvokeEvent, response: RdpAgentResponse): boolean => {
      const sessionId = pending.keyOf(response.requestId);
      if (!sessionId) return false;
      // Only the window the request went to may answer it, never another page.
      const window = getRdpWindow(sessionId);
      if (!window || window.webContents.id !== event.sender.id) return false;
      return pending.settle(
        response.requestId,
        response.ok ? { ok: true, value: response.frame } : { ok: false, error: response.error },
      );
    },
  );
}
