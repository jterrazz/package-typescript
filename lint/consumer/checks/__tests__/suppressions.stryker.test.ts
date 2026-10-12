import { describe, expect, test } from 'vitest';

import { commentSpansOf } from '../../../kit/project/comments.js';
import { placementOf } from '../suppressions.stryker.js';

const placed = (...lines: string[]): { line: number; rule: string }[] =>
    placementOf(lines, commentSpansOf(lines.join('\n'))).map(({ line, rule }) => ({ line, rule }));

const DIRECTIVE = '// Stryker disable next-line ConditionalExpression: a reason';

const ATTACHES = 'suppressions/stryker-attaches-to-a-mutant';

describe('placementOf', () => {
    test('placementOf — a directive above a line led by a closing brace is refused, at the directive, and one above code is not', () => {
        // Given - one directive above a closing brace and one above a statement
        const lines = ['function a(): void {', `    ${DIRECTIVE}`, '}', DIRECTIVE, 'const x = 1;'];

        // Then - the first is refused at its own line
        expect(placed(...lines)).toStrictEqual([{ line: 2, rule: ATTACHES }]);
    });

    test('placementOf — the next line is the next one that holds code: comment lines between are skipped, an unindented statement is code, and a directive on the last line has none', () => {
        // Given - a directive over a note over a brace, a directive over an unindented statement over an indented brace, and a directive at the end of the text
        const noted = placed(DIRECTIVE, '// a note', '/* another */', ' * a star line', '}');
        const code = placed(DIRECTIVE, 'call();', '    }');
        const last = placed('const a = 1;', DIRECTIVE);

        // Then - the brace after the notes is refused, the statement shields its brace, the last has no next line
        expect([noted, code, last]).toStrictEqual([[{ line: 1, rule: ATTACHES }], [], []]);
    });

    test('placementOf — a directive inside a JSX comment container is refused, whatever space stands inside the braces', () => {
        // Given - containers with no space, a space after the opening brace, a space before the closing one, and a directive in a string beside a plain comment
        const spaced = [
            '<div>{/* Stryker disable next-line Foo: r */}</div>',
            '<div>{ /* Stryker disable next-line Foo: r */}</div>',
            '<div>{/* Stryker disable next-line Foo: r */ }</div>',
        ];
        const quoted = [`const note = 'Stryker disable next-line Foo: r'; // plain`, '}'];

        // Then - each container is refused at its line; the string is no directive
        expect(placed(...spaced)).toStrictEqual([
            { line: 1, rule: ATTACHES },
            { line: 2, rule: ATTACHES },
            { line: 3, rule: ATTACHES },
        ]);
        expect(placed(...quoted)).toStrictEqual([]);
    });
});
