import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        sources: { extensions: ['tsx'], roots: ['src'] },
    },
});
