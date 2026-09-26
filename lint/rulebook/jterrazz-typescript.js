import { fileURLToPath } from 'node:url';

import { fragment, on } from './decision.js';

export default fragment({
    id: 'jterrazz-typescript',
    audience: 'consumer',
    jsPlugins: [fileURLToPath(new URL('../../src/oxlint-plugin/plugin.js', import.meta.url))],
    since: '11.0.0',
    rules: {
        'jterrazz-typescript/comment-longer-than-function': on(),
    },
});
