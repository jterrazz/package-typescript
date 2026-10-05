import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        oxlint: {
            overrides: [
                {
                    files: ['src/index.ts'],
                    reason: 'the process entry decides how the process ends: a graceful stop exits 0, a failed start or stop exits 1',
                    rules: { 'unicorn/no-process-exit': 'off' },
                },
            ],
        },
    },
});
