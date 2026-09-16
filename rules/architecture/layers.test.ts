import { expect, test } from 'vitest';

import { layers } from './layers.js';

const LAYER = {
    deny: ['**/adapters/**'],
    files: ['src/ports/**/*.ts'],
    message: 'a port names no adapter',
    name: 'ports',
};

test('a layer forbids the specifiers it denies and nothing else about its type imports', () => {
    // Given - a layer that says nothing about type imports
    // When - the map is compiled
    const [override] = layers({ map: [LAYER] }).overrides;

    // Then - the pattern carries the deny glob and no type-import exemption
    expect(override?.decisions['no-restricted-imports']?.options).toStrictEqual([
        { patterns: [{ group: ['**/adapters/**'], message: 'a port names no adapter' }] },
    ]);
});

test('a layer that allows type imports lets a contract cross without its runtime', () => {
    // Given - the same layer with type imports allowed
    // When - the map is compiled
    const [override] = layers({ map: [{ ...LAYER, allowTypeImports: true }] }).overrides;

    // Then - the pattern says so to oxlint
    expect(override?.decisions['no-restricted-imports']?.options).toStrictEqual([
        {
            patterns: [
                {
                    allowTypeImports: true,
                    group: ['**/adapters/**'],
                    message: 'a port names no adapter',
                },
            ],
        },
    ]);
});

test('two layers claiming one files glob are refused before oxlint erases one of them', () => {
    // Given - two layers on the same glob
    const map = [LAYER, { ...LAYER, name: 'twin' }];

    // Then - the map is refused by name
    expect(() => layers({ map })).toThrow('belongs to both "ports" and "twin"');
});
