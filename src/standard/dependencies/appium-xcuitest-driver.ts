import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        knip: {
            ignoreDependencies: {
                'appium-xcuitest-driver':
                    'Appium loads its driver by name when a mobile spec opens a device session: no import reaches it',
            },
        },
    },
});
