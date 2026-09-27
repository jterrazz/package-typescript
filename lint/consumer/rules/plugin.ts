import {
    COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME,
    commentNoLongerThanItsFunction,
} from './comments/comment-no-longer-than-its-function.js';

const plugin: { meta: { name: string }; rules: Readonly<Record<string, object>> } = {
    meta: { name: 'jterrazz-typescript' },
    rules: { [COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME]: commentNoLongerThanItsFunction },
};

export default plugin;
