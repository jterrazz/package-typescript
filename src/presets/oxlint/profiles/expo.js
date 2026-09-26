import { defineConfig } from 'oxlint';

import { profile } from '../../../../lint/rulebook/compile.js';
import { PROFILES } from '../../../../lint/rulebook/profiles.js';

export default defineConfig(profile(PROFILES.expo));
