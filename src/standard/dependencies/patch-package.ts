import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        toolRoots: {
            patches:
                'patch-package: the patches its postinstall applies to node_modules, read off this folder',
        },
    },
});
