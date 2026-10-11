import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        tsconfig: {
            compilerOptions: { types: ['node', 'vite/client'] },
            reason: "a Vite-bundled React tree imports stylesheets and assets whose module types are vite/client's (`import './globals.css'` is TS2882 without them), and its config files read Node's",
        },
    },
});
