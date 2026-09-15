import { defineConfig } from 'oxlint';

import { profile } from '../../../rules/compile.js';
import { PROFILES } from '../../../rules/profiles.js';

/** Node.js services and command-line tools: the rulebook, and nothing added. */
export default defineConfig(profile(PROFILES.node));
