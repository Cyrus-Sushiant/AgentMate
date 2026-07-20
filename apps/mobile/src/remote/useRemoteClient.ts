import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { MediaStream, RTCIceCandidate, RTCPeerConnection } from 'react-native-webrtc';
import { WebRtc } from './webrtc';
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
import {
  loadSavedDevices,
  removeSavedDevice,
  renameSavedDevice,
  touchSavedDevice,
  upsertSavedDevice,
  type SavedDevice,
} from './savedDevices';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * How the host's screen reaches us:
 * - 'webrtc'     — H.264 video track (primary; fast, adaptive, full frames)
 * - 'tiles'      — JPEG tiles over the WebSocket (fallback)
 * - 'negotiating'— waiting for the WebRTC handshake right after connect
 */
export type VideoMode = 'negotiating' | 'webrtc' | 'tiles';

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
/** If no video track arrives within this window, fall back to JPEG tiles. */
const RTC_FALLBACK_MS = 10_000;
const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function deviceName(): string {
  return Platform.OS === 'ios' ? 'AgentMate Mobile (iOS)' : 'AgentMate Mobile (Android)';
}

/**
 * Controller-role client for AgentMate's remote-control protocol
 * (see @agentmat/protocol and apps/desktop/src/main/remote/manager.ts).
 *
 * The control plane (auth, input, clipboard) is a plain WebSocket. The screen
 * itself streams over WebRTC: right after auth we send `rtc-request`, the host
 * offers an H.264 video track, and RTCView renders it. If negotiation fails
 * (old host version, exotic network), we cancel and the host resumes the
 * legacy JPEG-tile stream over the same socket.
 */
export function useRemoteClient() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [remoteDeviceName, setRemoteDeviceName] = useState<string | null>(null);
  const [remoteScreen, setRemoteScreen] = useState<RemoteScreenSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<RemoteLogEntry[]>([]);
  const [tiles, setTiles] = useState<Map<string, RemoteTile>>(new Map());
  const [videoMode, setVideoMode] = useState<VideoMode>('negotiating');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingIce = useRef<RTCIceCandidate[]>([]);
  const remoteDescSet = useRef(false);
  const rtcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTiles = useRef<Map<string, RemoteTile>>(new Map());
  const flushHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<ConnectionStatus>('idle');
  /** Connection details of the session being opened (for saving after pairing). */
  const dialing = useRef<{ ip: string; port: number; savedId: string | null } | null>(null);

  const appendLog = useCallback((level: RemoteLogEntry['level'], message: string) => {
    setLog((prev) => [{ level, message, at: Date.now() }, ...prev].slice(0, MAX_LOG));
  }, []);

  useEffect(() => {
    void loadSavedDevices().then(setSavedDevices);
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

  const closePeerConnection = useCallback(() => {
    if (rtcTimer.current != null) {
      clearTimeout(rtcTimer.current);
      rtcTimer.current = null;
    }
    pendingIce.current = [];
    remoteDescSet.current = false;
    const pc = pcRef.current;
    if (pc) {
      pcRef.current = null;
      try {
        pc.close();
      } catch {
        // already closed
      }
    }
    setRemoteStream(null);
  }, []);

  const fallbackToTiles = useCallback(
    (reason: string) => {
      closePeerConnection();
      setVideoMode('tiles');
      send({ t: 'rtc-cancel' });
      appendLog('warning', `Video stream unavailable (${reason}); using compatibility mode.`);
    },
    [appendLog, closePeerConnection, send],
  );

  const disconnect = useCallback(
    (reason = 'controller disconnected') => {
      closePeerConnection();
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
      dialing.current = null;
      statusRef.current = 'idle';
      setStatus('idle');
      setRemoteDeviceName(null);
      setRemoteScreen(null);
      setVideoMode('negotiating');
      resetTiles();
    },
    [closePeerConnection, resetTiles],
  );

  /** Host sent an SDP offer: answer it and start receiving the video track. */
  const acceptOffer = useCallback(
    async (sdp: string) => {
      if (!WebRtc) {
        fallbackToTiles('WebRTC module missing');
        return;
      }
      closePeerConnection();
      const pc = new WebRtc.RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;

      pc.addEventListener('track', (event) => {
        const stream = event.streams[0];
        if (!stream || pcRef.current !== pc) return;
        if (rtcTimer.current != null) {
          clearTimeout(rtcTimer.current);
          rtcTimer.current = null;
        }
        setRemoteStream(stream);
        setVideoMode('webrtc');
        resetTiles();
        appendLog('success', 'Video stream started.');
      });
      pc.addEventListener('icecandidate', (event) => {
        const candidate = event.candidate;
        if (!candidate || pcRef.current !== pc) return;
        send({
          t: 'rtc-ice',
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid ?? null,
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
        });
      });
      pc.addEventListener('connectionstatechange', () => {
        if (pcRef.current !== pc) return;
        if (pc.connectionState === 'failed') fallbackToTiles('connection failed');
      });

      await pc.setRemoteDescription(new WebRtc.RTCSessionDescription({ type: 'offer', sdp }));
      remoteDescSet.current = true;
      for (const candidate of pendingIce.current) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Individual candidates may fail; others usually connect anyway.
        }
      }
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ t: 'rtc-answer', sdp: answer.sdp ?? '' });
    },
    [appendLog, closePeerConnection, fallbackToTiles, resetTiles, send],
  );

  const open = useCallback(
    (payload: { ip: string; port: number; token: string; deviceName: string }, savedId: string | null) => {
      if (wsRef.current) disconnect();

      dialing.current = { ip: payload.ip, port: payload.port, savedId };
      statusRef.current = 'connecting';
      setStatus('connecting');
      setError(null);
      setRemoteDeviceName(payload.deviceName);
      setRemoteScreen(null);
      setVideoMode('negotiating');
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
            case 'auth-ok': {
              statusRef.current = 'connected';
              setStatus('connected');
              setRemoteDeviceName(msg.deviceName);
              if (msg.screen.width) setRemoteScreen(msg.screen);
              send({ t: 'control-start' });
              appendLog('success', `Connected to ${msg.deviceName}.`);

              // Remember this computer for one-tap reconnects.
              const dial = dialing.current;
              if (msg.deviceToken && dial) {
                void upsertSavedDevice({
                  hostName: msg.deviceName,
                  ip: dial.ip,
                  port: dial.port,
                  token: msg.deviceToken,
                }).then(setSavedDevices);
              } else if (dial?.savedId) {
                void touchSavedDevice(dial.savedId).then(setSavedDevices);
              }

              // Ask for the WebRTC video stream; fall back to tiles on timeout.
              // Without the native module (Expo Go / pre-WebRTC APK) skip the
              // request entirely so the host keeps sending tiles.
              if (WebRtc) {
                send({ t: 'rtc-request' });
                rtcTimer.current = setTimeout(() => {
                  rtcTimer.current = null;
                  if (statusRef.current === 'connected' && !pcRef.current) {
                    fallbackToTiles('timed out');
                  }
                }, RTC_FALLBACK_MS);
              } else {
                setVideoMode('tiles');
                appendLog('warning', 'This build has no WebRTC module; using compatibility mode.');
              }
              break;
            }
            case 'auth-fail':
              statusRef.current = 'error';
              setStatus('error');
              setError(
                dialing.current?.savedId
                  ? `${msg.reason}. The saved pairing may have been removed on the computer — pair again with a new code.`
                  : msg.reason,
              );
              appendLog('error', `Pairing rejected: ${msg.reason}`);
              break;
            case 'screen-info':
              setRemoteScreen({ width: msg.width, height: msg.height });
              resetTiles(); // tile coordinates from the old resolution are stale
              break;
            case 'rtc-offer':
              void acceptOffer(msg.sdp).catch(() => fallbackToTiles('negotiation error'));
              break;
            case 'rtc-ice': {
              if (!msg.candidate || !WebRtc) break;
              const candidate = new WebRtc.RTCIceCandidate({
                candidate: msg.candidate,
                sdpMid: msg.sdpMid,
                sdpMLineIndex: msg.sdpMLineIndex,
              });
              const pc = pcRef.current;
              if (pc && remoteDescSet.current) {
                void pc.addIceCandidate(candidate).catch(() => {});
              } else {
                pendingIce.current.push(candidate);
              }
              break;
            }
            case 'rtc-unavailable':
              fallbackToTiles(msg.reason);
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
        setError('Connection failed. Make sure the computer is hosting and reachable from this network.');
        appendLog('error', 'Connection failed.');
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        closePeerConnection();
        if (statusRef.current !== 'error') {
          statusRef.current = 'idle';
          setStatus('idle');
          setRemoteDeviceName(null);
          setRemoteScreen(null);
          resetTiles();
        }
      };
    },
    [
      acceptOffer,
      appendLog,
      closePeerConnection,
      disconnect,
      fallbackToTiles,
      resetTiles,
      scheduleFlush,
      send,
    ],
  );

  /** Connect with a fresh pairing code (QR scan or manual paste). */
  const connect = useCallback(
    (rawCode: string) => {
      const payload = decodePairingCode(rawCode);
      if (!payload) {
        setError('That pairing code is not valid.');
        setStatus('error');
        return;
      }
      open(payload, null);
    },
    [open],
  );

  /** Reconnect to a previously paired computer using its stored token. */
  const connectToSaved = useCallback(
    (device: SavedDevice) => {
      open({ ip: device.ip, port: device.port, token: device.token, deviceName: device.label }, device.id);
    },
    [open],
  );

  const renameDevice = useCallback(async (id: string, label: string) => {
    setSavedDevices(await renameSavedDevice(id, label));
  }, []);

  const removeDevice = useCallback(async (id: string) => {
    setSavedDevices(await removeSavedDevice(id));
  }, []);

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
      if (rtcTimer.current != null) clearTimeout(rtcTimer.current);
      pcRef.current?.close();
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
    videoMode,
    remoteStream,
    savedDevices,
    connect,
    connectToSaved,
    renameDevice,
    removeDevice,
    disconnect,
    sendInput,
    sendClipboardToHost,
  };
}
