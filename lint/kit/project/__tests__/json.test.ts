import { describe, expect, test } from 'vitest';

import {
    isJsonObject,
    listOf,
    objectOf,
    parsedObject,
    stringOf,
    stringRecordOf,
    stringsOf,
    textOf,
} from '../json.js';

describe('json', () => {
    test('isJsonObject — is an object that is neither null nor a list', () => {
        // Given - values of every kind
        const objects = [{}, { a: 1 }];
        const others = [null, undefined, [], [1], 'text', 3, true, () => 1];

        // Then - only the plain objects
        expect([objects.map(isJsonObject), others.map(isJsonObject)]).toStrictEqual([
            objects.map(() => true),
            others.map(() => false),
        ]);
    });

    test('listOf — is the list itself, and an empty one for anything else', () => {
        // Given - a list, and values that are none
        const list = [1, 'a'];

        // Then - the list as it is; nothing for the rest, an object with a length included
        expect(listOf(list)).toBe(list);
        expect([null, undefined, 'ab', { length: 1 }, 4].map(listOf)).toStrictEqual([
            [],
            [],
            [],
            [],
            [],
        ]);
    });

    test('objectOf — is the object itself, and an empty one for anything else', () => {
        // Given - an object
        const object = { a: 1 };

        // Then - the object as it is; nothing for the rest
        expect(objectOf(object)).toBe(object);
        expect([null, undefined, [1], 'text'].map(objectOf)).toStrictEqual([{}, {}, {}, {}]);
    });

    test('textOf and stringOf — read a string as it is, and anything else as the empty text and null', () => {
        // Given - a string, an empty one, and values that are none
        const others = [null, undefined, 1, ['a'], {}];

        // Then - textOf gives back the text or '', stringOf the text or null
        expect([textOf('a'), textOf(''), ...others.map(textOf)]).toStrictEqual([
            'a',
            '',
            '',
            '',
            '',
            '',
            '',
        ]);
        expect([stringOf('a'), stringOf(''), ...others.map(stringOf)]).toStrictEqual([
            'a',
            '',
            null,
            null,
            null,
            null,
            null,
        ]);
    });

    test('stringRecordOf — keeps the entries of an object that hold a string, and nothing of anything else', () => {
        // Given - an object of strings, numbers, nulls and an empty string
        const value = { a: 'x', b: 1, c: null, d: '', e: ['y'] };

        // Then - the strings only; an empty record for what is no object
        expect(stringRecordOf(value)).toStrictEqual({ a: 'x', d: '' });
        expect([stringRecordOf(null), stringRecordOf(['a']), stringRecordOf('a')]).toStrictEqual([
            {},
            {},
            {},
        ]);
    });

    test('stringsOf — keeps the strings of a list in order, and is empty for anything else', () => {
        // Given - a list of mixed entries
        const value = ['a', 1, '', null, 'b', ['c']];

        // Then - the strings; nothing for what is no list
        expect(stringsOf(value)).toStrictEqual(['a', '', 'b']);
        expect([stringsOf('ab'), stringsOf({ 0: 'a' }), stringsOf(null)]).toStrictEqual([
            [],
            [],
            [],
        ]);
    });

    test('parsedObject — is the object a text holds, and an empty one for a text that holds anything else', () => {
        // Given - JSON of an object, a list and a number
        // Then - the object alone
        expect(parsedObject('{"a":1}')).toStrictEqual({ a: 1 });
        expect([parsedObject('[1]'), parsedObject('3')]).toStrictEqual([{}, {}]);
    });
});
