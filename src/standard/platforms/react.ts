import { defineStandard } from '../../../lint/index.config.js';
import { PUBLIC_ROOT } from '../standard.js';

export default defineStandard({
    typescript: {
        sources: { extensions: ['tsx'], roots: [] },
        toolRoots: { public: PUBLIC_ROOT },
        tsconfigPreset: 'react',
        verbatimToolRoots: ['public'],
    },
});
