import { defineConfig } from 'oxlint';

import { profile } from '../../../lint/compile.js';
import { PROFILES } from '../../../lint/profiles.js';

/** Next.js: the rulebook, plus React, accessibility and Next's own 21 rules. */
export default defineConfig(profile(PROFILES.next));
