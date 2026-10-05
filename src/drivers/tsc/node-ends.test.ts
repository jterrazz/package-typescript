import { describe, expect, test } from 'vitest';

import { lastLineReader } from './node-ends.js';

describe('lastLineReader', () => {
    test('lines opening a block, a call or a literal run to the end of what they open, and a line opening nothing stays alone', () => {
        // Given - a function, an if inside it, a call over three lines and a closing brace
        const lastLine = lastLineReader(
            'src/c.ts',
            [
                'export function f(a: number): number {',
                '    if (a > 1) {',
                '        return a;',
                '    }',
                '    return g(',
                '        a,',
                '    );',
                '}',
            ].join('\n'),
        );

        // Then - each line runs to the last line of the nodes starting on it
        expect([lastLine(1, 1), lastLine(2, 2), lastLine(5, 5), lastLine(8, 8)]).toStrictEqual([
            8, 4, 7, 8,
        ]);
    });
});
