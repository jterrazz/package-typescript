import { defineStandard } from '../../../lint/index.config.js';
import { APP_ROOT, ASSETS_ROOT } from '../standard.js';

const HERMES =
    'Hermes, the engine an Expo app runs on, implements no `Array#toSorted` nor `toReversed`: the rule would rewrite a `[...list].sort()` into a call that throws at launch, which no gate but a device run sees — the tsconfig preset stops its `lib` at ES2022 so the type check refuses those calls instead';

export default defineStandard({
    typescript: {
        manifestKeys: ['expo'],
        oxlint: {
            rules: {
                'unicorn/no-array-reverse': { level: 'off', reason: HERMES },
                'unicorn/no-array-sort': { level: 'off', reason: HERMES },
            },
        },
        sources: { extensions: ['tsx'], roots: ['app'] },
        toolRoots: {
            android: 'React Native and Expo — the native Android project',
            app: APP_ROOT,
            assets: ASSETS_ROOT,
            ios: 'React Native and Expo — the native iOS project',
        },
        tsconfigPreset: 'expo',
        verbatimToolRoots: ['assets'],
    },
});
