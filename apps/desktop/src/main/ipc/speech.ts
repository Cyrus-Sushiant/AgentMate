import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type {
  SpeechModelProgress,
  SpeechModelState,
  TranscribeAudioInput,
  TranscribeAudioResult,
} from '../../shared/apiTypes';
import { store } from '../store';

// Whisper ONNX weights, served from the Hugging Face hub the first time and
// then cached to disk. onnx-community publishes the quantized variants
// transformers.js expects; `base` is the accuracy/size sweet spot for short
// dictation (~150MB), `tiny` is the lighter fallback.
const MODEL_IDS: Record<string, string> = {
  tiny: 'onnx-community/whisper-tiny',
  base: 'onnx-community/whisper-base',
  small: 'onnx-community/whisper-small',
};
const DEFAULT_MODEL_KEY = 'base';

function resolveModelId(modelKey: string | undefined): string {
  return MODEL_IDS[modelKey ?? ''] ?? MODEL_IDS[DEFAULT_MODEL_KEY];
}

// transformers.js is ESM-only for its Node build and pulls in the native
// onnxruntime-node addon, so it's loaded lazily on first use rather than at
// startup — that keeps app launch fast and avoids paying the cost for users
// who never touch voice input.
type TransformersModule = typeof import('@huggingface/transformers');
// pipeline() is typed to return a union of every pipeline class, which isn't
// callable. Narrow to the ASR pipeline instance — that's what
// 'automatic-speech-recognition' actually produces.
type AsrPipeline = InstanceType<TransformersModule['AutomaticSpeechRecognitionPipeline']>;

let transformersPromise: Promise<TransformersModule> | null = null;
async function loadTransformers(): Promise<TransformersModule> {
  if (!transformersPromise) {
    transformersPromise = import('@huggingface/transformers').then((mod) => {
      // Models are cached under userData so they survive app updates and never
      // land inside the read-only asar. Local-only lookups are disabled: the
      // first run must be allowed to fetch from the hub.
      mod.env.cacheDir = join(app.getPath('userData'), 'whisper-models');
      mod.env.allowLocalModels = false;
      mod.env.allowRemoteModels = true;
      return mod;
    });
  }
  return transformersPromise;
}

// One pipeline instance is kept alive per model id. Building it loads the
// weights into memory, which is expensive — reusing it makes every
// transcription after the first one fast.
let pipelinePromise: Promise<AsrPipeline> | null = null;
let loadedModelId: string | null = null;

function broadcastProgress(progress: SpeechModelProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.speech.onModelProgress, progress);
  }
}

async function getPipeline(modelId: string): Promise<AsrPipeline> {
  if (pipelinePromise && loadedModelId === modelId) return pipelinePromise;

  const { pipeline } = await loadTransformers();
  loadedModelId = modelId;
  pipelinePromise = (pipeline('automatic-speech-recognition', modelId, {
    // transformers.js reports download progress per-file; forward it so the UI
    // can show a "downloading model" state on the very first use.
    progress_callback: (item: unknown) => {
      const p = item as { status?: string; file?: string; progress?: number };
      if (p.status === 'progress' || p.status === 'download') {
        broadcastProgress({
          percent: typeof p.progress === 'number' ? Math.round(p.progress) : null,
          file: p.file ?? '',
        });
      }
    },
  }) as Promise<AsrPipeline>).catch((error) => {
    // Reset so a later attempt can retry instead of resolving the cached
    // rejected promise forever.
    pipelinePromise = null;
    loadedModelId = null;
    throw error;
  });

  return pipelinePromise;
}

async function transcribe(input: TranscribeAudioInput): Promise<string> {
  const settings = await store.getSettings();
  const modelId = resolveModelId(settings.speechModel);
  const transcriber = await getPipeline(modelId);

  // The pipeline accepts more options than its published types expose (e.g.
  // `task`), so call through a permissive signature.
  const run = transcriber as unknown as (
    audio: Float32Array,
    options: Record<string, unknown>,
  ) => Promise<{ text?: string } | { text?: string }[]>;

  const output = await run(input.samples, {
    // 'auto' lets Whisper detect the spoken language, matching Prompt Builder's
    // existing multilingual flow (the description is normalized to English
    // downstream anyway).
    language: input.language && input.language !== 'auto' ? input.language : undefined,
    task: 'transcribe',
    // Whisper's context window is 30s; chunking lets longer dictation through.
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  const text = Array.isArray(output) ? (output[0]?.text ?? '') : (output.text ?? '');
  return text.trim();
}

export function registerSpeechHandlers(): void {
  ipcMain.handle(
    IPC.speech.transcribe,
    async (_event, input: TranscribeAudioInput): Promise<TranscribeAudioResult> => {
      try {
        const text = await transcribe(input);
        return { ok: true, text };
      } catch (error) {
        return {
          ok: false,
          text: '',
          error: (error as Error).message || 'Transcription failed.',
        };
      }
    },
  );

  ipcMain.handle(IPC.speech.getModelState, async (): Promise<SpeechModelState> => {
    const settings = await store.getSettings();
    const modelId = resolveModelId(settings.speechModel);
    return { ready: loadedModelId === modelId && pipelinePromise !== null, modelId };
  });
}
