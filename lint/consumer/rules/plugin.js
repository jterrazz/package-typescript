import {
    COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME,
    commentNoLongerThanItsFunction,
} from './comments/comment-no-longer-than-its-function.js';

export default {
    meta: { name: 'jterrazz-typescript' },
    rules: { [COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME]: commentNoLongerThanItsFunction },
};
