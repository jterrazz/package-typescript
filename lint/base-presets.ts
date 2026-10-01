import { typescriptPreset } from './consumer/catalogue/preset.js';
import type { Preset } from './engine/project/preset.js';

export const BASE_PRESETS: readonly Preset[] = Object.freeze([typescriptPreset()]);
