import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        oxlint: {
            overrides: [
                {
                    files: ['src/*.bin.ts'],
                    reason: 'a command’s entry decides its exit status, which is what its caller reads',
                    rules: { 'unicorn/no-process-exit': 'off' },
                },
            ],
        },
    },
});
