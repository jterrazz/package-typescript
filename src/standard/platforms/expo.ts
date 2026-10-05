import { defineStandard } from '../../../lint/index.config.js';
import { APP_ROOT } from '../standard.js';

export default defineStandard({
    typescript: {
        sources: { extensions: ['tsx'], roots: ['app'] },
        toolRoots: {
            android: 'React Native and Expo — the native Android project',
            app: APP_ROOT,
            ios: 'React Native and Expo — the native iOS project',
        },
        tsconfigPreset: 'expo',
    },
});
