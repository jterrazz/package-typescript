import { defineConfig } from 'oxlint';

import { profile } from '../../../rules/compile.js';
import { PROFILES } from '../../../rules/profiles.js';

/*
 * A published package: the node rulebook, plus the one tree a library carries
 * and never lints — the committed typedoc projection.
 *
 * The `.js` extension on every relative import is core's (`import/extensions`
 * at `always`), because Node ESM resolves a specifier literally and a package
 * published as ESM is read by Node before any bundler reads it. It pairs with
 * `presets/tsconfig/library.json`, whose `isolatedDeclarations` is what makes
 * the declarations emit without a type-checker.
 */
export default defineConfig(profile(PROFILES.library));
