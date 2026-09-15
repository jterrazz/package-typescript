import { defineConfig } from 'oxlint';

import { profile } from '../../../rules/compile.js';
import { PROFILES } from '../../../rules/profiles.js';

/*
 * Astro: the rulebook, plus React (an island is a React component here),
 * accessibility, and the decisions an `.astro` file's own shape forces.
 */
export default defineConfig(profile(PROFILES.astro));
