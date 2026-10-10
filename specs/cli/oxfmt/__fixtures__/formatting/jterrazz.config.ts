import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    typescript: {
        roots: {
            schema: { reason: 'the schema its generator writes byte for byte', verbatim: true },
        },
    },
});
