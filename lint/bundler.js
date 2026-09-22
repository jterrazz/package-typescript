import { fragment } from './_contract.js';
import { EXTENSIONS_NEVER } from './language/import.js';

/*
 * A bundled tree with no framework behind it — Vite, Remotion, a browser
 * extension. oxlint has no plugin to load for one, so this fragment carries a
 * single decision: the bundler resolves the specifier, so an import carries no
 * extension.
 *
 * `lint/next.js`, `lint/astro.js` and `lint/react-native.js` each state the
 * same decision inside their own framework fragment, where it sits beside that
 * framework's plugin. A profile with no framework fragment states it here.
 */
export default fragment({
    id: 'bundler',
    rules: {
        'import/extensions': EXTENSIONS_NEVER,
    },
});
