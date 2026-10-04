import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'mobile',
    platform: 'expo',
    presets: [test()],
    test: { projects: [{ facet: 'unit' }] },
    typescript: {
        knip: {
            entry: {
                'app/**/*.tsx':
                    'Expo Router reads the screens off app/; the specimen installs no expo-router for knip’s plugin to say so',
            },
        },
    },
});
