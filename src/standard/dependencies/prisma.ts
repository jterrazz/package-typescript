import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        oxlint: {
            overrides: [
                {
                    files: ['src/infrastructure/outbound/persistence/**'],
                    reason: 'a Prisma batch transaction takes the lazy PrismaPromises its queries return, and an async wrapper would run each query before the transaction does',
                    rules: { 'typescript/promise-function-async': 'off' },
                },
            ],
        },
    },
});
