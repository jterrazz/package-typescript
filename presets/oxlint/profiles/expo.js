import { defineConfig } from 'oxlint';

import { profile } from '../../../rules/compile.js';
import { PROFILES } from '../../../rules/profiles.js';

/** Expo and React Native: the rulebook, plus React, accessibility and the platform. */
export default defineConfig(profile(PROFILES.expo));
