import { defineStandard } from '../../../lint/index.config.js';
import { ASSETS_ROOT, PUBLIC_ROOT } from '../standard.js';

export default defineStandard({
    typescript: {
        toolRoots: { assets: ASSETS_ROOT, public: PUBLIC_ROOT },
        tsconfigPreset: 'astro',
        verbatimToolRoots: ['assets', 'public'],
    },
});
