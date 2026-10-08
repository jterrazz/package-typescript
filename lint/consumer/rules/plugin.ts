import {
    ACCESSIBLE_ELEMENT_IS_JSX_NAME,
    accessibleElementIsJsx,
} from './accessibility/accessible-element-is-jsx.js';
import {
    FOCUSABLE_SECTION_IS_LABELLED_NAME,
    focusableSectionIsLabelled,
} from './accessibility/focusable-section-is-labelled.js';
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
import {
    ERROR_FAMILY_SHARES_ITS_BASE_NAME,
    errorFamilySharesItsBase,
} from './modules/error-family-shares-its-base.js';
import { PROMISE_IS_AWAITED_NAME, promiseIsAwaited } from './promises/promise-is-awaited.js';

const plugin: { meta: { name: string }; rules: Readonly<Record<string, object>> } = {
    meta: { name: 'jterrazz-typescript' },
    rules: {
        [ACCESSIBLE_ELEMENT_IS_JSX_NAME]: accessibleElementIsJsx,
        [COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME]: commentNoLongerThanItsFunction,
        [COMMENT_STATES_ITS_KIND_NAME]: commentStatesItsKind,
        [DATA_MODULE_HOLDS_DATA_NAME]: dataModuleHoldsData,
        [ERROR_FAMILY_SHARES_ITS_BASE_NAME]: errorFamilySharesItsBase,
        [FOCUSABLE_SECTION_IS_LABELLED_NAME]: focusableSectionIsLabelled,
        [PROMISE_IS_AWAITED_NAME]: promiseIsAwaited,
    },
};

export default plugin;
