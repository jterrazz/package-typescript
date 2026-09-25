import { defineConfig } from 'oxlint';

import { profile } from '../../../../lint/compile.js';
import { PROFILES } from '../../../../lint/profiles.js';

/** Astro: the rulebook, plus React (an island is a React component), accessibility and `.astro`'s own shape. */
export default defineConfig(profile(PROFILES.astro));
