import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  REMOTE_PROTOCOL_VERSION,
  binaryKind,
  decodePairingCode,
  decodeScreenTile,
  jpegToDataUri,
  BIN_SCREEN_TILE,
  type RemoteControlMessage,
  type RemoteInputEvent,
} from '@agentmat/protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface RemoteTile {
  x: number;
  y: number;
  w: number;
  h: number;
  uri: string;
}

export interface RemoteLogEntry {
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  at: number;
}

interface RemoteScreenSize {
  width: number;
  height: number;
}

const MAX_LOG = 50;
const TILE_FLUSH_MS = 33;

function deviceName(): string {
  return Platform.OS === 'ios' ? 'AgentMate Mobile (iOS)' : 'AgentMate Mobile (Android)';
}

/**
 * Controller-role client for AgentMate's remote-control protocol
 * (see @agentmat/protocol and apps/desktop/src/main/remote/manager.ts's
 * `connect()`, whose controller-role behavior this mirrors). Unlike the
 * desktop app, the socket is opened directly here — there's no separate
 * main/renderer split to protect on mobile.
 */
export function useRemoteClient() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [remoteDeviceName, setRemoteDeviceName] = useState<string | null>(null);
  const [remoteScreen, setRemoteScreen] = useState<RemoteScreenSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<RemoteLogEntry[]>([]);
  const [tiles, setTiles] = useState<Map<string, RemoteTile>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const pendingTiles = useRef<Map<string, RemoteTile>>(new Map());
  const flushHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<ConnectionStatus>('idle');

  const appendLog = useCallback((level: RemoteLogEntry['level'], message: string) => {
    setLog((prev) => [{ level, message, at: Date.now() }, ...prev].slice(0, MAX_LOG));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushHandle.current != null) return;
    flushHandle.current = setTimeout(() => {
      flushHandle.current = null;
      setTiles(new Map(pendingTiles.current));
    }, TILE_FLUSH_MS);
  }, []);

  const resetTiles = useCallback(() => {
    pendingTiles.current = new Map();
    setTiles(new Map());
  }, []);

  const send = useCallback((msg: RemoteControlMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const disconnect = useCallback(
    (reason = 'controller disconnected') => {
      const ws = wsRef.current;
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'bye', reason }));
        } catch {
          // socket already gone
        }
        ws.close();
        wsRef.current = null;
      }
      statusRef.current = 'idle';
      setStatus('idle');
      setRemoteDeviceName(null);
      setRemoteScreen(null);
      resetTiles();
    },
    [resetTiles],
  );

  const connect = useCallback(
    (rawCode: string) => {
      const payload = decodePairingCode(rawCode);
      if (!payload) {
        setError('That pairing code is not valid.');
        setStatus('error');
        return;
      }
      if (wsRef.current) disconnect();

      statusRef.current = 'connecting';
      setStatus('connecting');
      setError(null);
      setRemoteDeviceName(payload.deviceName);
      setRemoteScreen(null);
      resetTiles();

      const ws = new WebSocket(`ws://${payload.ip}:${payload.port}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        send({ t: 'hello', role: 'controller', deviceName: deviceName(), protocolVersion: REMOTE_PROTOCOL_VERSION });
        send({ t: 'auth', token: payload.token });
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          let msg: RemoteControlMessage;
          try {
            msg = JSON.parse(event.data) as RemoteControlMessage;
          } catch {
            return;
          }
          switch (msg.t) {
            case 'auth-ok':
              statusRef.current = 'connected';
              setStatus('connected');
              setRemoteDeviceName(msg.deviceName);
              if (msg.screen.width) setRemoteScreen(msg.screen);
              send({ t: 'control-start' });
              appendLog('success', `Connected to ${msg.deviceName}.`);
              break;
            case 'auth-fail':
              statusRef.current = 'error';
              setStatus('error');
              setError(msg.reason);
              appendLog('error', `Pairing rejected: ${msg.reason}`);
              break;
            case 'screen-info':
              setRemoteScreen({ width: msg.width, height: msg.height });
              resetTiles();
              break;
            case 'clipboard':
              void Clipboard.setStringAsync(msg.text);
              appendLog('info', 'Clipboard received from host.');
              break;
            case 'bye':
              appendLog('info', `Host said goodbye: ${msg.reason}`);
              disconnect();
              break;
            default:
              break;
          }
          return;
        }

        const bytes = new Uint8Array(event.data as ArrayBuffer);
        if (binaryKind(bytes) === BIN_SCREEN_TILE) {
          const tile = decodeScreenTile(bytes);
          pendingTiles.current.set(`${tile.x},${tile.y}`, {
            x: tile.x,
            y: tile.y,
            w: tile.w,
            h: tile.h,
            uri: jpegToDataUri(tile.jpeg),
          });
          scheduleFlush();
        }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        statusRef.current = 'error';
        setStatus('error');
        setError('Connection failed. Make sure both devices are on the same network.');
        appendLog('error', 'Connection failed.');
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        if (statusRef.current !== 'error') {
          statusRef.current = 'idle';
          setStatus('idle');
          setRemoteDeviceName(null);
          setRemoteScreen(null);
          resetTiles();
        }
      };
    },
    [appendLog, disconnect, resetTiles, scheduleFlush, send],
  );

  const sendInput = useCallback((event: RemoteInputEvent) => send({ t: 'input', event }), [send]);

  const sendClipboardToHost = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (!text) return;
    send({ t: 'clipboard', text });
    appendLog('info', 'Clipboard sent.');
  }, [appendLog, send]);

  useEffect(() => {
    return () => {
      if (flushHandle.current != null) clearTimeout(flushHandle.current);
      wsRef.current?.close();
    };
  }, []);

  return {
    status,
    remoteDeviceName,
    remoteScreen,
    error,
    log,
    tiles,
    connect,
    disconnect,
    sendInput,
    sendClipboardToHost,
  };
}
