import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        knip: {
            entry: {
                'src/*.bin.ts':
                    "a command's entry, which its bin or its compiled build runs: no import reaches it",
            },
        },
        oxlint: {
            overrides: [
                {
                    files: ['src/*.bin.ts'],
                    reason: "a command's entry decides its exit status, which is what its caller reads",
                    rules: { 'unicorn/no-process-exit': 'off' },
                },
            ],
        },
    },
});
