import { fragment } from './_contract.js';
import { EXTENSIONS_NEVER } from './language/import.js';

// oxlint has no plugin for a bare bundler, so this fragment carries its one decision: no extension on an import.
export default fragment({
    id: 'bundler',
    audience: 'consumer',
    rules: {
        'import/extensions': EXTENSIONS_NEVER,
    },
});
