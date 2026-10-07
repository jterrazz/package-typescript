import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        knip: {
            ignoreDependencies: {
                '@astrojs/check':
                    'the Astro pass of `typescript check` spawns `astro check`, which loads it: no import reaches it',
            },
        },
    },
});
