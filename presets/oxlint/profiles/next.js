import { defineConfig } from 'oxlint';

import { profile } from '../../../rules/compile.js';
import { PROFILES } from '../../../rules/profiles.js';

/** Next.js: the rulebook, plus React, accessibility and Next's own 21 rules. */
export default defineConfig(profile(PROFILES.next));
