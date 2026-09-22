import { defineConfig } from 'oxlint';

import { profile } from '../../../lint/compile.js';
import { PROFILES } from '../../../lint/profiles.js';

/** Node.js services and command-line tools: the rulebook, and nothing added. */
export default defineConfig(profile(PROFILES.node));
