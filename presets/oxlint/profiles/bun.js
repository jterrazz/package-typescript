import { defineConfig } from 'oxlint';

import { profile } from '../../../rules/compile.js';
import { PROFILES } from '../../../rules/profiles.js';

/** Bun: the node rulebook, plus the globals Bun's runtime defines. */
export default defineConfig(profile(PROFILES.bun));
