import { defineConfig } from 'oxlint';

import { profile } from '../../../../lint/compile.js';
import { PROFILES } from '../../../../lint/profiles.js';

export default defineConfig(profile(PROFILES.react));
