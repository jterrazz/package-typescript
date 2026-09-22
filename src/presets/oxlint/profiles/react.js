import { defineConfig } from 'oxlint';

import { profile } from '../../../../lint/compile.js';
import { PROFILES } from '../../../../lint/profiles.js';

/** React with no framework under it: the rulebook, plus React and accessibility. */
export default defineConfig(profile(PROFILES.react));
