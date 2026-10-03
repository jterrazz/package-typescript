import { fragment } from '../../../kit/compiler/decision.js';
import { IMPORT_EXTENSIONS_NEVER } from '../import.js';

// oxlint has no plugin for a bare bundler, so this fragment carries its one decision: no extension on an import.
export default fragment({
    id: 'frameworks/bundler',
    audience: 'consumer',
    rules: {
        'import/extensions': IMPORT_EXTENSIONS_NEVER,
    },
});
