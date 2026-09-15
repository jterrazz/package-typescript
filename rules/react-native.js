import { fragment, on } from './_contract.js';
import { EXTENSIONS_NEVER } from './core/import.js';

/*
 * React Native. oxlint 1.83 ships no `react-native` plugin, so this fragment
 * is not a plugin roster: it is the three decisions the platform forces, plus
 * the globals its runtime defines.
 *
 * Metro resolves an import, so a specifier carries no extension — except an
 * asset, which Metro resolves BY its extension, and `require()` is how an
 * asset is named in a React Native tree.
 */
export default fragment({
    id: 'react-native',
    globals: {
        __DEV__: 'readonly',
        ErrorUtils: 'readonly',
        FormData: 'readonly',
        XMLHttpRequest: 'readonly',
        fetch: 'readonly',
        requestAnimationFrame: 'readonly',
    },
    ignorePatterns: ['.expo/**', 'assets/**', 'ios/**', 'android/**'],
    rules: {
        'import/extensions': EXTENSIONS_NEVER,
        'no-restricted-imports': on([
            {
                patterns: [
                    {
                        group: ['react-dom', 'react-dom/*', 'next', 'next/*'],
                        message: 'this is a React Native tree — the DOM and Next are not on it',
                    },
                ],
            },
        ]),
        'typescript/no-require-imports': on([
            {
                allow: [
                    String.raw`\.gif$`,
                    String.raw`\.jpeg$`,
                    String.raw`\.jpg$`,
                    String.raw`\.png$`,
                    String.raw`\.webp$`,
                ],
            },
        ]),
    },
});
