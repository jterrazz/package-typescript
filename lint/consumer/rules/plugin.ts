import {
    COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME,
    commentNoLongerThanItsFunction,
} from './comments/comment-no-longer-than-its-function.js';
import {
    COMMENT_STATES_ITS_KIND_NAME,
    commentStatesItsKind,
} from './comments/comment-states-its-kind.js';
import {
    DATA_MODULE_HOLDS_DATA_NAME,
    dataModuleHoldsData,
} from './modules/data-module-holds-data.js';

const plugin: { meta: { name: string }; rules: Readonly<Record<string, object>> } = {
    meta: { name: 'jterrazz-typescript' },
    rules: {
        [COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME]: commentNoLongerThanItsFunction,
        [COMMENT_STATES_ITS_KIND_NAME]: commentStatesItsKind,
        [DATA_MODULE_HOLDS_DATA_NAME]: dataModuleHoldsData,
    },
};

export default plugin;
