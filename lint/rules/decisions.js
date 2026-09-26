import { fileURLToPath } from 'node:url';

import { fragment, on } from '../rulebook/decision.js';

export default fragment({
    id: 'jterrazz-typescript',
    audience: 'consumer',
    jsPlugins: [fileURLToPath(new URL('plugin.js', import.meta.url))],
    since: '11.0.0',
    rules: {
        'jterrazz-typescript/comment-no-longer-than-its-function': on(),
    },
});
