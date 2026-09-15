import { defineConfig } from 'oxlint';

import { profile } from '../../../rules/compile.js';
import { PROFILES } from '../../../rules/profiles.js';

/** React with no framework under it: the rulebook, plus React and accessibility. */
export default defineConfig(profile(PROFILES.react));
