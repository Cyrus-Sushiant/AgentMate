import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceStatus = 'idle' | 'requesting' | 'recording' | 'transcribing';

// Whisper is trained on 16 kHz mono audio; the microphone almost always
// captures at 44.1/48 kHz, so we resample down before handing samples to the
// main process. Doing the conversion here (Web Audio) keeps ffmpeg and every
// other audio tool out of the packaged app.
const WHISPER_SAMPLE_RATE = 16000;

interface UseVoiceInputOptions {
  /** Whisper language code ("en", "fa", …) or "auto". */
  language: string;
  /** Called with the transcribed text once recording stops and transcription finishes. */
  onText: (text: string) => void;
}

interface UseVoiceInput {
  status: VoiceStatus;
  /** 0–100 while the model downloads on first use, otherwise null. */
  downloadPercent: number | null;
  error: string | null;
  /** Start recording if idle, stop-and-transcribe if recording. */
  toggle: () => void;
  supported: boolean;
}

async function blobToWhisperSamples(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();

  // Decode at whatever rate the browser recorded, then resample to 16 kHz mono
  // through an OfflineAudioContext.
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    void decodeCtx.close();
  }

  const frameCount = Math.ceil((decoded.duration * WHISPER_SAMPLE_RATE) || 0);
  if (frameCount === 0) return new Float32Array(0);

  const offline = new OfflineAudioContext(1, frameCount, WHISPER_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  // Channel 0 is the mono mixdown OfflineAudioContext produced for us.
  return rendered.getChannelData(0);
}

export function useVoiceInput({ language, onText }: UseVoiceInputOptions): UseVoiceInput {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  // Surface first-run model-download progress pushed from the main process.
  useEffect(() => {
    const unsubscribe = window.agentmat.speech.onModelProgress((progress) => {
      setDownloadPercent(progress.percent);
    });
    return unsubscribe;
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setStatus('transcribing');
      try {
        const samples = await blobToWhisperSamples(blob);
        if (samples.length === 0) {
          setStatus('idle');
          return;
        }
        const result = await window.agentmat.speech.transcribe({ samples, language });
        if (result.ok) {
          if (result.text) onText(result.text);
        } else {
          setError(result.error || 'Transcription failed.');
        }
      } catch (err) {
        setError((err as Error).message || 'Could not process the recording.');
      } finally {
        setDownloadPercent(null);
        setStatus('idle');
      }
    },
    [language, onText],
  );

  const start = useCallback(async () => {
    setError(null);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void transcribe(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setStatus('recording');
    } catch (err) {
      stopTracks();
      setStatus('idle');
      const name = (err as Error).name;
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it to use voice input.'
          : name === 'NotFoundError'
            ? 'No microphone was found.'
            : (err as Error).message || 'Could not start recording.',
      );
    }
  }, [stopTracks, transcribe]);

  const stop = useCallback(() => {
    // The recorder's onstop handler kicks off transcription.
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (status === 'recording') stop();
    else if (status === 'idle') void start();
  }, [status, start, stop]);

  // Release the mic if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      stopTracks();
    };
  }, [stopTracks]);

  return { status, downloadPercent, error, toggle, supported };
}
