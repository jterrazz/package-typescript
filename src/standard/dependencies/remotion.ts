import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        knip: {
            entry: {
                'remotion.config.ts': 'the Remotion CLI loads its config file by this name',
                'src/index.ts':
                    "the Remotion CLI bundles the project's root from this file by name",
            },
        },
    },
});
