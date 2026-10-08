import { fragment, on } from '../../kit/compiler/decision.js';

export default fragment({
    id: 'jterrazz-typescript',
    audience: 'consumer',
    jsPlugins: ['jterrazz-typescript'],
    since: '11.0.0',
    rules: {
        'jterrazz-typescript/accessible-element-is-jsx': on(),
        'jterrazz-typescript/comment-no-longer-than-its-function': on(),
        'jterrazz-typescript/comment-states-its-kind': on(),
        'jterrazz-typescript/data-module-holds-data': on(),
        'jterrazz-typescript/error-family-shares-its-base': on(),
        'jterrazz-typescript/focusable-section-is-labelled': on(),
        'jterrazz-typescript/promise-is-awaited': on(),
    },
});
