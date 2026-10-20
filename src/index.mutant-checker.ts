import { MUTANT_CHECKER } from './drivers/stryker/stryker.js';
import { NativeChecker } from './drivers/tsc/mutant-checker.js';

/** The plugin Stryker loads by path: the checker, under the name the config gives it. */
export const strykerPlugins = [
    { injectableClass: NativeChecker, kind: 'Checker', name: MUTANT_CHECKER },
] as const;
