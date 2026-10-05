import { defineStandard } from '../../../lint/index.config.js';
import { PUBLIC_ROOT } from '../standard.js';

export default defineStandard({
    typescript: { toolRoots: { public: PUBLIC_ROOT }, tsconfigPreset: 'astro' },
});
