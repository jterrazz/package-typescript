import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'library',
    platform: 'node',
    typescript: { generated: { schema: 'the schema its generator writes byte for byte' } },
});
