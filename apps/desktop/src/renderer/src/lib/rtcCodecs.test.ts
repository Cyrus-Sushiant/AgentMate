import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The probe result is cached for the whole session, which is the behaviour under test, so each
 * case loads a fresh copy of the module.
 */
type Codecs = typeof import('./rtcCodecs');

interface EncodingAnswer {
  supported: boolean;
  powerEfficient: boolean;
}

const encodingInfo = vi.fn();

function installMediaCapabilities(answers: Record<string, EncodingAnswer> | null): void {
  if (answers === null) {
    Object.defineProperty(navigator, 'mediaCapabilities', {
      configurable: true,
      value: undefined,
    });
    return;
  }
  encodingInfo.mockImplementation(async (config: { video: { contentType: string } }) => {
    const answer = answers[config.video.contentType];
    if (!answer) throw new Error('unknown content type');
    return answer;
  });
  Object.defineProperty(navigator, 'mediaCapabilities', {
    configurable: true,
    value: { encodingInfo },
  });
}

async function load(): Promise<Codecs> {
  vi.resetModules();
  return import('./rtcCodecs');
}

const hardware: EncodingAnswer = { supported: true, powerEfficient: true };
const software: EncodingAnswer = { supported: true, powerEfficient: false };

function codec(mimeType: string): RTCRtpCapabilities['codecs'][number] {
  return { mimeType, clockRate: 90_000 };
}

beforeEach(() => {
  encodingInfo.mockReset();
});

afterEach(() => {
  Object.defineProperty(navigator, 'mediaCapabilities', { configurable: true, value: undefined });
});

describe('preferredCodecOrder', () => {
  it('puts hardware H264 first, then hardware AV1, then VP9', async () => {
    installMediaCapabilities({
      'video/H264': hardware,
      'video/AV1': hardware,
      'video/VP9': software,
      'video/VP8': software,
    });
    const { preferredCodecOrder } = await load();
    const order = await preferredCodecOrder([
      codec('video/VP8'),
      codec('video/VP9'),
      codec('video/AV1'),
      codec('video/H264'),
    ]);
    expect(order.map((c) => c.mimeType)).toEqual([
      'video/H264',
      'video/AV1',
      'video/VP9',
      'video/VP8',
    ]);
  });

  it('drops a software-only H264 behind VP9', async () => {
    // A software encoder on a busy host is worse than hardware anything, for latency and for
    // the quality pulsing a starved encoder produces.
    installMediaCapabilities({
      'video/H264': software,
      'video/AV1': software,
      'video/VP9': software,
      'video/VP8': software,
    });
    const { preferredCodecOrder } = await load();
    const order = await preferredCodecOrder([
      codec('video/H264'),
      codec('video/VP9'),
      codec('video/AV1'),
    ]);
    expect(order.map((c) => c.mimeType)).toEqual(['video/VP9', 'video/H264', 'video/AV1']);
  });

  it('keeps every codec, only reordering them', async () => {
    installMediaCapabilities({ 'video/H264': hardware });
    const { preferredCodecOrder } = await load();
    const input = [
      codec('video/rtx'),
      codec('video/red'),
      codec('video/H264'),
      codec('video/ulpfec'),
    ];
    const order = await preferredCodecOrder(input);
    // Negotiation has to be able to fall back to whatever the two ends genuinely share.
    expect(order).toHaveLength(input.length);
    expect(new Set(order.map((c) => c.mimeType))).toEqual(new Set(input.map((c) => c.mimeType)));
    expect(order[0].mimeType).toBe('video/H264');
  });

  it('keeps unrecognized entries in the order they came in', async () => {
    installMediaCapabilities({ 'video/H264': hardware });
    const { preferredCodecOrder } = await load();
    const order = await preferredCodecOrder([codec('video/rtx'), codec('video/red')]);
    expect(order.map((c) => c.mimeType)).toEqual(['video/rtx', 'video/red']);
  });

  it('matches a codec whatever case the browser reports it in', async () => {
    installMediaCapabilities({ 'video/H264': hardware, 'video/VP9': software });
    const { preferredCodecOrder } = await load();
    const order = await preferredCodecOrder([codec('video/vp9'), codec('video/h264')]);
    expect(order.map((c) => c.mimeType)).toEqual(['video/h264', 'video/vp9']);
  });

  it('does nothing to an empty list', async () => {
    installMediaCapabilities({ 'video/H264': hardware });
    const { preferredCodecOrder } = await load();
    expect(await preferredCodecOrder([])).toEqual([]);
  });

  it('does not reorder the list it was handed', async () => {
    installMediaCapabilities({ 'video/H264': hardware });
    const { preferredCodecOrder } = await load();
    const input = [codec('video/VP8'), codec('video/H264')];
    await preferredCodecOrder(input);
    expect(input.map((c) => c.mimeType)).toEqual(['video/VP8', 'video/H264']);
  });
});

describe('detectEncoderSupport', () => {
  it('probes each codec once per session and reuses the answer', async () => {
    installMediaCapabilities({
      'video/H264': hardware,
      'video/AV1': software,
      'video/VP9': software,
      'video/VP8': software,
    });
    const { detectEncoderSupport } = await load();
    const first = await detectEncoderSupport();
    const second = await detectEncoderSupport();
    expect(second).toBe(first);
    expect(encodingInfo).toHaveBeenCalledTimes(4);
  });

  it('assumes usable software when the browser has no probe', async () => {
    installMediaCapabilities(null);
    const { detectEncoderSupport } = await load();
    const support = await detectEncoderSupport();
    expect(support.get('video/h264')).toEqual({ supported: true, powerEfficient: false });
  });

  it('assumes usable software when the probe throws', async () => {
    installMediaCapabilities({});
    const { detectEncoderSupport } = await load();
    const support = await detectEncoderSupport();
    expect(support.get('video/av1')).toEqual({ supported: true, powerEfficient: false });
  });

  it('probes at a resolution representative of a downscaled desktop share', async () => {
    installMediaCapabilities({ 'video/H264': hardware });
    const { detectEncoderSupport } = await load();
    await detectEncoderSupport();
    expect(encodingInfo).toHaveBeenCalledWith({
      type: 'webrtc',
      video: {
        contentType: 'video/H264',
        width: 1280,
        height: 720,
        bitrate: 2_500_000,
        framerate: 30,
      },
    });
  });
});

describe('describeEncoderSupport', () => {
  it('summarizes each codec as hardware, software or unsupported', async () => {
    installMediaCapabilities({
      'video/H264': hardware,
      'video/AV1': software,
      'video/VP9': { supported: false, powerEfficient: false },
      'video/VP8': software,
    });
    const { describeEncoderSupport } = await load();
    // The names come back lowercased, since that is the form the support map is keyed by.
    expect(await describeEncoderSupport()).toBe('h264:hw av1:sw vp9:no vp8:sw');
  });
});
