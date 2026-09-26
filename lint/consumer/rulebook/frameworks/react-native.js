import { fragment, on } from '../../../engine/compiler/decision.js';
import { IMPORT_EXTENSIONS_NEVER } from '../import.js';

// oxlint ships no `react-native` plugin. Metro resolves an import but resolves an asset by its extension,
// and `require()` is how an asset is named in a React Native tree.
export default fragment({
    id: 'frameworks/react-native',
    audience: 'consumer',
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
        'import/extensions': IMPORT_EXTENSIONS_NEVER,
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
