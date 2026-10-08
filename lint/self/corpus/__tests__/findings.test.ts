import { describe, expect, test } from 'vitest';

import { DOCS_RULES } from '../../../consumer/checks/docs.decisions.js';
import {
    FOCUSABLE_SECTION_IS_LABELLED_NAME,
    focusableSectionIsLabelled,
} from '../../../consumer/rules/accessibility/focusable-section-is-labelled.js';
import {
    COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME,
    commentNoLongerThanItsFunction,
} from '../../../consumer/rules/comments/comment-no-longer-than-its-function.js';
import {
    COMMENT_STATES_ITS_KIND_NAME,
    commentStatesItsKind,
} from '../../../consumer/rules/comments/comment-states-its-kind.js';
import {
    DATA_MODULE_HOLDS_DATA_NAME,
    dataModuleHoldsData,
} from '../../../consumer/rules/modules/data-module-holds-data.js';
import {
    ERROR_FAMILY_SHARES_ITS_BASE_NAME,
    errorFamilySharesItsBase,
} from '../../../consumer/rules/modules/error-family-shares-its-base.js';
import plugin from '../../../consumer/rules/plugin.js';
import {
    PROMISE_IS_AWAITED_NAME,
    promiseIsAwaited,
} from '../../../consumer/rules/promises/promise-is-awaited.js';
import { FAMILIES, FINDINGS, printedFindingIds } from '../findings.js';

describe('findings', () => {
    test('printedFindingIds — findings — the catalogue holds every id a pass or a rule prints, and no other', () => {
        // Given - every finding id written in a pass, and every rule the plugin registers
        const printed = printedFindingIds();
        expect(printed.length).toBeGreaterThan(50);

        // Then - each has its row, and each row is still printed somewhere
        expect(FINDINGS.map((row) => row.id).toSorted()).toStrictEqual(printed);
    });

    test('printedFindingIds — findings — every row states its family and the one sentence it holds a project to', () => {
        // Given - every row of the findings catalogue
        expect(FINDINGS.length).toBeGreaterThan(50);

        // Then - its family is a word of the closed list, and its sentence is one sentence
        expect(
            FINDINGS.flatMap((row) =>
                [
                    FAMILIES.includes(row.family) ? null : `${row.id} has an unknown family`,
                    /^[A-Z`].*\.$/u.test(row.sentence) ? null : `${row.id} states no sentence`,
                ].filter((broken) => broken !== null),
            ),
        ).toStrictEqual([]);
    });

    test('printedFindingIds — findings — the union a docs consumer compares with is every docs row', () => {
        // Given - the rows of the docs family
        const catalogued = FINDINGS.filter(({ family }) => family === 'docs').map(({ id }) => id);

        // Then - the ids @jterrazz/typescript/docs publishes are exactly those rows
        expect([...DOCS_RULES].toSorted()).toStrictEqual(catalogued.toSorted());
    });

    test('printedFindingIds — the rules of the oxlint plugin — each teaches the row of its id: its family, its sentence, its audience and a kind oxlint knows', () => {
        // Given - every rule the plugin registers, beside its catalogue row
        const rules = {
            [COMMENT_NO_LONGER_THAN_ITS_FUNCTION_NAME]: commentNoLongerThanItsFunction.meta,
            [COMMENT_STATES_ITS_KIND_NAME]: commentStatesItsKind.meta,
            [DATA_MODULE_HOLDS_DATA_NAME]: dataModuleHoldsData.meta,
            [ERROR_FAMILY_SHARES_ITS_BASE_NAME]: errorFamilySharesItsBase.meta,
            [FOCUSABLE_SECTION_IS_LABELLED_NAME]: focusableSectionIsLabelled.meta,
            [PROMISE_IS_AWAITED_NAME]: promiseIsAwaited.meta,
        };
        expect(Object.keys(rules).toSorted()).toStrictEqual(Object.keys(plugin.rules).toSorted());
        const taught = Object.entries(rules).map(([name, { docs, type }]) => {
            const row = FINDINGS.find(({ id }) => id === `jterrazz-typescript/${name}`);
            const kind = ['problem', 'suggestion'].includes(type) ? type : '?';
            return [docs.name, docs.audience, docs.family, docs.sentence, kind].join(' | ') ===
                [name, 'consumer', row?.family, row?.sentence, type].join(' | ')
                ? null
                : name;
        });

        // Then - none departs from its row
        expect(taught.filter((name) => name !== null)).toStrictEqual([]);
    });
});
