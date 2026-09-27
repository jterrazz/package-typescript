import { test } from '@jterrazz/test/config';
import { typescript } from '@jterrazz/typescript/config';
import { defineConfig, fromPresets } from '@jterrazz/typescript/oxlint';

export default defineConfig(fromPresets({ presets: [typescript({ profile: 'node' }), test()] }));
