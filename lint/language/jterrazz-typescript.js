import { fileURLToPath } from 'node:url';

import { fragment, on } from '../_contract.js';

export default fragment({
    id: 'language/jterrazz-typescript',
    audience: 'consumer',
    jsPlugins: [fileURLToPath(new URL('../../src/oxlint-plugin/plugin.js', import.meta.url))],
    since: '11.0.0',
    rules: {
        'jterrazz-typescript/comment-longer-than-function': on(),
    },
});
