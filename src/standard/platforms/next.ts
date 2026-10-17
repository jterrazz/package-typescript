import { defineStandard } from '../../../lint/index.config.js';
import { APP_ROOT, PUBLIC_ROOT } from '../standard.js';

export default defineStandard({
    typescript: {
        sources: { extensions: ['tsx'], roots: ['app', 'pages'] },
        toolRoots: {
            app: APP_ROOT,
            pages: 'Next.js Pages Router: routes are read off this folder',
            public: PUBLIC_ROOT,
        },
        tsconfigPreset: 'next',
        verbatimToolRoots: ['public'],
    },
});
