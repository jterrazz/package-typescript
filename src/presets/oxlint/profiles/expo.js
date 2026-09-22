import { defineConfig } from 'oxlint';

import { profile } from '../../../../lint/compile.js';
import { PROFILES } from '../../../../lint/profiles.js';

/** Expo and React Native: the rulebook, plus React, accessibility and the platform. */
export default defineConfig(profile(PROFILES.expo));
