import { ruleTester } from '@jterrazz/test';

import { noNamedGroupsInMatchAll } from '../no-named-groups-in-match-all.js';

const FILENAME = '/nowhere/src/parse.ts';

ruleTester().run('no-named-groups-in-match-all', noNamedGroupsInMatchAll, {
    invalid: [
        {
            code: 'export const all = (text: string) => [...text.matchAll(/(?<key>\\w+)=(?<value>\\w+)/gu)];',
            errors: [{ column: 41, line: 1, messageId: 'named' }],
            filename: FILENAME,
            name: 'a pattern written in the call',
        },
        {
            code: [
                String.raw`const PAIR = /(?<key>\w+)=(\w+)/gu;`,
                'export const all = (text: string) => [...text.matchAll(PAIR)];',
            ].join('\n'),
            errors: [{ column: 41, line: 2, messageId: 'named' }],
            filename: FILENAME,
            name: 'a const holding the pattern',
        },
    ],
    valid: [
        {
            code: 'export const all = (text: string) => [...text.matchAll(/(\\w+)=(\\w+)/gu)];',
            filename: FILENAME,
            name: 'a pattern with positional groups',
        },
        {
            code: 'export const all = (text: string) => [...text.matchAll(/(?<=a)b(?<!c)/gu)];',
            filename: FILENAME,
            name: 'look-behinds name nothing',
        },
        {
            code: [
                String.raw`const PAIR = /(?<key>\w+)=(\w+)/gu;`,
                'export const first = (text: string) => PAIR.exec(text)?.groups?.key;',
            ].join('\n'),
            filename: FILENAME,
            name: 'exec reads named groups as the engine does',
        },
    ],
});
