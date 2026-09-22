import { defineConfig } from 'oxlint';

import { profile } from '../../../../lint/compile.js';
import { PROFILES } from '../../../../lint/profiles.js';

/** Bun: the node rulebook, plus the globals Bun's runtime defines. */
export default defineConfig(profile(PROFILES.bun));
