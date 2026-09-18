import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_TRANSPORT_MODE,
  type NegotiationPhase,
  PHASE_LABELS,
  RemoteTransportMode,
} from './transport';

describe('transport mode', () => {
  it('defaults to hardware video, not the fallback', () => {
    // A default of JPEG tiles is what the explicit transport split was meant to prevent.
    expect(DEFAULT_TRANSPORT_MODE).toBe(RemoteTransportMode.WEBRTC_VIDEO);
  });

  it('labels every negotiation phase', () => {
    // The debug overlay prints these, so a new phase without a label would render blank.
    const phases: NegotiationPhase[] = [
      'idle',
      'requesting',
      'offer-received',
      'answered',
      'connected',
      'failed',
      'unsupported',
    ];
    for (const phase of phases) {
      expect(PHASE_LABELS[phase]).toBeTruthy();
    }
    expect(Object.keys(PHASE_LABELS)).toHaveLength(phases.length);
  });
});
