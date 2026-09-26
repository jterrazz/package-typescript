import { fragment } from '../decision.js';
import { EXTENSIONS_NEVER } from '../import.js';

// oxlint has no plugin for a bare bundler, so this fragment carries its one decision: no extension on an import.
export default fragment({
    id: 'frameworks/bundler',
    audience: 'consumer',
    rules: {
        'import/extensions': EXTENSIONS_NEVER,
    },
});
