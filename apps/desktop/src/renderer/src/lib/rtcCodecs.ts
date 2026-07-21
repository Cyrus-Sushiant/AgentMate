/**
 * Runtime codec selection for the screen-share sender.
 *
 * Codec *availability* (`RTCRtpSender.getCapabilities`) says nothing about
 * whether encoding is hardware-backed — and a software AV1 encoder on a busy
 * host is far worse than hardware H.264, both for latency and for the quality
 * pulsing a starved encoder produces. `navigator.mediaCapabilities.encodingInfo`
 * is the API that answers the question that actually matters, via its
 * `powerEfficient` flag, so preference order is measured at runtime rather than
 * hardcoded.
 *
 * Resulting order: hardware H.264 → hardware AV1 → VP9 → software fallbacks.
 * Nothing is ever removed from the list, only reordered, so negotiation can
 * always fall back to whatever the two ends genuinely share.
 */

type VideoCodecCapability = RTCRtpCapabilities['codecs'][number];

interface EncodeSupport {
  supported: boolean;
  powerEfficient: boolean;
}

/** Probe resolution — representative of a downscaled desktop share. */
const PROBE = { width: 1280, height: 720, bitrate: 2_500_000, framerate: 30 };

let cachedSupport: Map<string, EncodeSupport> | null = null;

interface WebrtcEncodingConfig {
  type: 'webrtc';
  video: {
    contentType: string;
    width: number;
    height: number;
    bitrate: number;
    framerate: number;
  };
}

async function probeCodec(mimeType: string): Promise<EncodeSupport> {
  const capabilities = navigator.mediaCapabilities as MediaCapabilities | undefined;
  if (!capabilities?.encodingInfo) return { supported: true, powerEfficient: false };
  try {
    const config: WebrtcEncodingConfig = {
      type: 'webrtc',
      video: { contentType: mimeType, ...PROBE },
    };
    // `type: 'webrtc'` is not in the DOM lib's MediaEncodingType union yet.
    const info = await capabilities.encodingInfo(
      config as unknown as MediaEncodingConfiguration,
    );
    return { supported: info.supported, powerEfficient: info.powerEfficient };
  } catch {
    // Unknown content type or unimplemented probe — assume usable software.
    return { supported: true, powerEfficient: false };
  }
}

/**
 * Probes the hardware encoders once per session. Results are stable for a given
 * machine, and probing is a few milliseconds, so this runs lazily on the first
 * peer connection rather than at startup.
 */
export async function detectEncoderSupport(): Promise<Map<string, EncodeSupport>> {
  if (cachedSupport) return cachedSupport;
  const mimeTypes = ['video/H264', 'video/AV1', 'video/VP9', 'video/VP8'];
  const results = await Promise.all(mimeTypes.map((m) => probeCodec(m)));
  cachedSupport = new Map(mimeTypes.map((m, i) => [m.toLowerCase(), results[i]]));
  return cachedSupport;
}

function rank(codec: VideoCodecCapability, support: Map<string, EncodeSupport>): number {
  const mime = codec.mimeType.toLowerCase();
  const hw = support.get(mime)?.powerEfficient ?? false;
  if (mime === 'video/h264') return hw ? 0 : 3;
  if (mime === 'video/av1') return hw ? 1 : 4;
  if (mime === 'video/vp9') return 2;
  if (mime === 'video/vp8') return 5;
  // RTX / RED / FEC and anything unrecognized keep their relative order last.
  return 6;
}

export async function preferredCodecOrder(
  codecs: VideoCodecCapability[],
): Promise<VideoCodecCapability[]> {
  const support = await detectEncoderSupport();
  return [...codecs]
    .map((codec, index) => ({ codec, index, score: rank(codec, support) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.codec);
}

/** Human-readable summary for the benchmark log. */
export async function describeEncoderSupport(): Promise<string> {
  const support = await detectEncoderSupport();
  return [...support.entries()]
    .map(([mime, s]) => `${mime.replace('video/', '')}:${s.supported ? (s.powerEfficient ? 'hw' : 'sw') : 'no'}`)
    .join(' ');
}
