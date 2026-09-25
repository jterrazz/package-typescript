import { commentLongerThanFunction, RULE_NAME } from './comment-longer-than-function.js';

export default {
    meta: { name: 'jterrazz-typescript' },
    rules: { [RULE_NAME]: commentLongerThanFunction },
};
