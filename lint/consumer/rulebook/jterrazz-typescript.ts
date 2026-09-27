import { fragment, on } from '../../engine/compiler/decision.js';

export default fragment({
    id: 'jterrazz-typescript',
    audience: 'consumer',
    jsPlugins: ['jterrazz-typescript'],
    since: '11.0.0',
    rules: {
        'jterrazz-typescript/comment-no-longer-than-its-function': on(),
    },
});
