import { describe, expect, it } from 'vitest';
import { BLUEPRINT_STEP_IDS, type BlueprintStepId } from '../types/index.js';
import { normalizeBlueprintPreset } from './normalize.js';
import {
  BLUEPRINT_STEPS,
  blueprintPresetSeed,
  blueprintStep,
  DEFAULT_BLUEPRINT_PRESETS,
} from './steps.js';

/**
 * This table is the only place a step's name is written: the rail, the prompt
 * headings, the markdown block and the Settings preset groups all read it. A missing
 * step would leave a gap in the wizard, and a duplicate heading would make two
 * sections of the generated plan indistinguishable.
 */

describe('BLUEPRINT_STEPS', () => {
  it('covers every step id exactly once, in the same order', () => {
    expect(BLUEPRINT_STEPS.map((step) => step.id)).toEqual([...BLUEPRINT_STEP_IDS]);
  });

  it('gives every step the four strings the UI and the prompt need', () => {
    for (const step of BLUEPRINT_STEPS) {
      expect(step.label.trim(), step.id).not.toBe('');
      expect(step.hint.trim(), step.id).not.toBe('');
      expect(step.heading.trim(), step.id).not.toBe('');
      expect(step.placeholder.trim(), step.id).not.toBe('');
    }
  });

  it('keeps labels and headings unique', () => {
    const labels = BLUEPRINT_STEPS.map((step) => step.label);
    const headings = BLUEPRINT_STEPS.map((step) => step.heading);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it('keeps every heading a single line, since it becomes a markdown heading', () => {
    for (const step of BLUEPRINT_STEPS) {
      expect(step.heading, step.id).not.toMatch(/[\r\n]/);
      expect(step.heading, step.id).not.toMatch(/^#/);
    }
  });
});

describe('blueprintStep', () => {
  it('finds each step by id', () => {
    for (const id of BLUEPRINT_STEP_IDS) {
      expect(blueprintStep(id).id, id).toBe(id);
    }
  });

  it('falls back to the first step for a value that slipped past validation', () => {
    // Only reachable from a doctored blueprints.json or an old backup.
    expect(blueprintStep('not-a-step' as BlueprintStepId)).toBe(BLUEPRINT_STEPS[0]);
  });
});

describe('DEFAULT_BLUEPRINT_PRESETS', () => {
  it('only names steps that exist', () => {
    const ids = new Set<string>(BLUEPRINT_STEP_IDS);
    for (const preset of DEFAULT_BLUEPRINT_PRESETS) {
      expect(ids.has(preset.stepId), preset.label).toBe(true);
    }
  });

  it('gives every preset a label and text worth inserting', () => {
    for (const preset of DEFAULT_BLUEPRINT_PRESETS) {
      expect(preset.label.trim(), preset.label).not.toBe('');
      // The label is chip text, and the store caps it at 60 characters.
      expect(preset.label.length, preset.label).toBeLessThanOrEqual(60);
      expect(preset.text.trim().length, preset.label).toBeGreaterThan(10);
    }
  });

  it('keeps labels unique within a step, which is how the chips are grouped', () => {
    const seen = new Set<string>();
    for (const preset of DEFAULT_BLUEPRINT_PRESETS) {
      const key = `${preset.stepId}:${preset.label}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });
});

describe('blueprintPresetSeed', () => {
  it('turns the starter set into storable records with the ids it is handed', () => {
    let next = 0;
    const seeded = blueprintPresetSeed(() => `preset-${next++}`);
    expect(seeded).toHaveLength(DEFAULT_BLUEPRINT_PRESETS.length);
    expect(seeded.map((preset) => preset.id)).toEqual(
      DEFAULT_BLUEPRINT_PRESETS.map((_, index) => `preset-${index}`),
    );
  });

  it('keeps the label, step and text of each starter preset', () => {
    const seeded = blueprintPresetSeed(() => 'id');
    for (const [index, preset] of seeded.entries()) {
      expect(preset.label, preset.label).toBe(DEFAULT_BLUEPRINT_PRESETS[index].label);
      expect(preset.stepId, preset.label).toBe(DEFAULT_BLUEPRINT_PRESETS[index].stepId);
      expect(preset.text, preset.label).toBe(DEFAULT_BLUEPRINT_PRESETS[index].text);
    }
  });

  it('stamps every seeded preset with one parseable timestamp', () => {
    const seeded = blueprintPresetSeed(() => 'id');
    const stamps = new Set(seeded.map((preset) => preset.createdAt));
    expect(stamps.size).toBe(1);
    expect(Number.isNaN(Date.parse(seeded[0].createdAt))).toBe(false);
  });

  it('produces presets the store will accept back unchanged', () => {
    let next = 0;
    for (const preset of blueprintPresetSeed(() => `preset-${next++}`)) {
      expect(normalizeBlueprintPreset(preset), preset.label).toEqual(preset);
    }
  });
});
