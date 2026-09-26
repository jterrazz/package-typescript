import {
    commentNoLongerThanItsFunction,
    RULE_NAME,
} from './comments/comment-no-longer-than-its-function.js';

export default {
    meta: { name: 'jterrazz-typescript' },
    rules: { [RULE_NAME]: commentNoLongerThanItsFunction },
};
