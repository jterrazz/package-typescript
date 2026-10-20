import { ruleTester } from '@jterrazz/test';

import { noNamedGroupsInMatchAll } from '../no-named-groups-in-match-all.js';

const FILENAME = '/nowhere/src/parse.ts';

ruleTester().run('no-named-groups-in-match-all', noNamedGroupsInMatchAll, {
    invalid: [
        {
            code: String.raw`export const all = (text: string) => [...text.matchAll(/(?<key>\w+)=(?<value>\w+)/gu)];`,
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
        {
            code: [
                String.raw`const PAIR = /(?<key>\w+)=(\w+)/gu;`,
                'export const inner = (text: string) => {',
                '    class PAIR {}',
                '    return [new PAIR(), ...text.matchAll(PAIR)];',
                '};',
            ].join('\n'),
            errors: [{ column: 27, line: 4, messageId: 'named' }],
            filename: FILENAME,
            name: 'a class of the name beside the const declares no pattern, and the const stays the pattern',
        },
    ],
    valid: [
        {
            code: [
                String.raw`const PAIR = /(\w+)=(\w+)/gu;`,
                'export const all = (text: string) => [...text.matchAll(PAIR)];',
            ].join('\n'),
            filename: FILENAME,
            name: 'a const holding a pattern with no named group is no named pattern',
        },
        {
            code: [
                String.raw`const PAIR = /(\w+)=(\w+)/gu;`,
                'export const inner = (text: string) => {',
                String.raw`    const PAIR = /(\w+)/gu;`,
                '    return [...text.matchAll(PAIR)];',
                '};',
            ].join('\n'),
            filename: FILENAME,
            name: 'a name declared in two scopes with no named group stays unnamed',
        },
        {
            code: String.raw`export const built = (text: string) => new text.matchAll(/(?<key>\w+)/gu);`,
            filename: FILENAME,
            name: 'a construction is no call of matchAll',
        },
        {
            code: [
                "const matchAll = 'matchAll';",
                String.raw`export const all = (text: string) => text[matchAll](/(?<key>\w+)/gu);`,
            ].join('\n'),
            filename: FILENAME,
            name: 'a member read through a variable is no matchAll, whatever the variable is called',
        },
        {
            code: 'export const all = (text: string, pattern: RegExp) => [...text.matchAll(pattern)];',
            filename: FILENAME,
            name: 'a pattern handed in as a parameter is unknown, and so left alone',
        },
        {
            code: [
                String.raw`const PAIR = /(?<key>\w+)=(\w+)/gu;`,
                'export const inner = (text: string) => {',
                String.raw`    const PAIR = /(\w+)=(\w+)/gu;`,
                '    return [...text.matchAll(PAIR)];',
                '};',
            ].join('\n'),
            filename: FILENAME,
            name: 'a name declared in two scopes is no pattern the rule can tell',
        },
        {
            code: String.raw`export const all = (text: string) => [...text['matchAll'](/(?<key>\w+)/gu)];`,
            filename: FILENAME,
            name: 'a computed member is no matchAll',
        },
        {
            code: String.raw`export const all = (text: string) => text.replaceAll(/(?<key>\w+)/gu, "x");`,
            filename: FILENAME,
            name: 'another method given a named group is no business of this rule',
        },
        {
            code: String.raw`declare function matchAll(pattern: RegExp): void; matchAll(/(?<key>\w+)/gu);`,
            filename: FILENAME,
            name: 'a bare function named matchAll is no method',
        },
        {
            code: 'export const none = (text: string) => [...text.matchAll()];',
            filename: FILENAME,
            name: 'a call with no pattern',
        },
        {
            code: [
                'let PAIR: RegExp | undefined;',
                'const { other } = { other: 1 };',
                'export const all = (text: string) => [...text.matchAll(PAIR as RegExp)];',
                'export default other;',
            ].join('\n'),
            filename: FILENAME,
            name: 'a declaration holding nothing, and a destructuring naming none',
        },
        {
            code: String.raw`export const all = (text: string) => [...text.matchAll(/(\w+)=(\w+)/gu)];`,
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
