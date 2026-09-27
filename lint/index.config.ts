import { typescriptPreset } from './consumer/catalogue/preset.js';
import type { Preset } from './engine/project/preset.js';

export { definePreset } from './engine/project/preset.js';
export type { ArchitectureRule, NamesRule, OptOut, Preset } from './engine/project/preset.js';
export { typescriptPreset as typescript } from './consumer/catalogue/preset.js';
export type { ProfileName } from './consumer/catalogue/preset.js';

export const BASE_PRESETS: readonly Preset[] = Object.freeze([typescriptPreset()]);
