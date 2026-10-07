import { fragment, off, on } from '../../../kit/compiler/decision.js';
import { IMPORT_EXTENSIONS_NEVER } from '../import.js';

// outside: oxlint ships no `react-native` plugin. Metro resolves an import but resolves an asset by its extension,
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
        'react/capitalized-calls': off(
            {
                by: 'signews-mobile pilot, 2026-10-06 — 4 reports, 0 a component called as a function: react-native-gesture-handler builds its gestures with capitalised factories (`Gesture.Pan()`, `Tap()`, `Native()`, `Exclusive()`), as React Native names `PlatformColor` and `DynamicColorIOS` — the evidence that turned eslint/new-cap off',
                kind: 'evidence',
            },
            '11.0.0',
        ),
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
