/*
 * features/common is the carve-out: a Rust regex has no lookahead, so the map
 * spells it as the deny glob plus the same glob negated.
 */
import { SHARED } from '../../../presentation/features/common/shared.js';

export const value = SHARED;
