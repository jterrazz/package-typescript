import { PROFILES } from './consumer/rulebook/profiles.js';
import { unsafeFixers } from './engine/catalogue/decisions.js';

export const UNSAFE_FIXERS = unsafeFixers(PROFILES);
