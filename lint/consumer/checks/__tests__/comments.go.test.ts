import { describe, expect, test } from 'vitest';

import { commentsOfGo } from '../comments.go.js';

const lines = (...text: string[]): string => text.join('\n');

const openingsOf = (text: string): string[] =>
    commentsOfGo(text).map(({ opening }) => opening.trim());

describe('commentsOfGo', () => {
    test('leaves the documentation of the package and of each exported name, and reads the rest', () => {
        // Given - a package comment, the doc of an exported func, a method, a type and a var, then comments above unexported names and a trailing one
        const text = lines(
            '// Package runtimes lays the runtime folders.',
            'package runtimes',
            '',
            '// Install writes the folders.',
            'func Install() {}',
            '',
            '// Name reads the name of a runtime.',
            'func (r Runtime) Name() string { return r.name }',
            '',
            '// Runtime is one of the supported runtimes.',
            'type Runtime struct{}',
            '',
            '// walk descends the tree.',
            'func walk() {}',
            '',
            'var total = 0 // the count so far',
        );

        // Then - the unexported func's comment and the trailing one
        expect(openingsOf(text)).toStrictEqual(['walk descends the tree.', 'the count so far']);
    });

    test('reads a name declared inside a const block as documented, and a blank line between as no documentation', () => {
        // Given - a block whose first name is documented, and a comment separated from its declaration
        const text = lines(
            'const (',
            '\t// Claude is the default runtime.',
            '\tClaude = "claude"',
            '',
            '\t// gone is not exported.',
            '\tgone = "gone"',
            ')',
            '',
            '// Detached stands apart.',
            '',
            'func Detached() {}',
        );

        // Then - the unexported name's comment and the detached one
        expect(openingsOf(text)).toStrictEqual(['gone is not exported.', 'Detached stands apart.']);
    });

    test('reads a run of lines once, and a build constraint as the comment it is for the pass to recognise', () => {
        // Given - a two-line run above an unexported func, a build constraint, a generator line and a block
        const text = lines(
            '//go:build linux',
            '',
            '//go:generate stringer -type=Kind',
            'package kinds',
            '',
            '// first line',
            '// second line',
            'func run() {}',
            '/* a block',
            '   over lines */',
            'func other() {}',
        );

        // Then - each run opens on its first line, the build constraint among them for the pass to recognise, the generator line above the package clause being its documentation
        expect(openingsOf(text)).toStrictEqual([
            'go:build linux',
            'first line',
            'a block\n   over lines */',
        ]);
    });

    test('reads no comment marker inside a string, a raw string or a rune', () => {
        // Given - a url in a string, a raw string over two lines holding `//`, and a rune
        const text = lines(
            'var a = "https://example.com" // trailing',
            'var b = `line // one',
            '/* two */`',
            "var c = '/'",
        );

        // Then - the one trailing comment
        expect(openingsOf(text)).toStrictEqual(['trailing']);
    });
});
