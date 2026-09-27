import { test } from '@jterrazz/test/config';
import { defineConfig, typescript } from '@jterrazz/typescript/config';

export default defineConfig({ presets: [typescript({ profile: 'node' }), test()] });
