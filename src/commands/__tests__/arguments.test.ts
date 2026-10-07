import { describe, expect, test } from 'vitest';

import { readArguments } from '../arguments.js';
import { SURFACES } from '../surface.js';

const READ = 'read: docs/reference/commands.md#flags-and-help';

describe('readArguments', () => {
    test('hands a command its flags each spelled apart from its value, a joined value split, a repeating flag kept every time', () => {
        // Given - check, fix and mutation lines using both spellings of a value
        // When - each is read against its surface
        const read = [
            readArguments('check', SURFACES.check, [
                '--ignore-pattern=dist/**',
                '--json',
                '--ignore-pattern',
                'assets/**',
            ]),
            readArguments('mutation', SURFACES.mutation, [
                '--since=main',
                '--mutate',
                'src/a.ts:1-2',
            ]),
            readArguments('docs-layout', SURFACES['docs-layout'], ['docs']),
            readArguments('docs-layout', SURFACES['docs-layout'], []),
        ];

        // Then - the arguments the command runs on, in the order given
        expect(read).toStrictEqual([
            {
                args: ['--ignore-pattern', 'dist/**', '--json', '--ignore-pattern', 'assets/**'],
                kind: 'run',
            },
            { args: ['--since', 'main', '--mutate', 'src/a.ts:1-2'], kind: 'run' },
            { args: ['docs'], kind: 'run' },
            { args: [], kind: 'run' },
        ]);
    });

    test('reads a help request anywhere before --, over any line it would refuse', () => {
        // Given - help after a flag, after an unknown flag, and after the end of the own flags
        // When - each is read
        const read = [
            readArguments('check', SURFACES.check, ['--json', '-h']),
            readArguments('fix', SURFACES.fix, ['--bogus', '--help']),
            readArguments('build', SURFACES.build, ['--', '--help']),
        ];

        // Then - the first two print the help; the third is no help, and its -- is refused
        expect(read.map(({ kind }) => kind)).toStrictEqual(['help', 'help', 'refused']);
    });

    test('forwards what start is given but its help, every argument after --, and every argument tsc is given', () => {
        // Given - start with an argument of its own, with -- before a help, and tsc asked for its own help
        // When - each is read
        const read = [
            readArguments('start', SURFACES.start, ['--port', '3000']),
            readArguments('start', SURFACES.start, ['serve', '--', '--help', '-h']),
            readArguments('start', SURFACES.start, ['-h']),
            readArguments('tsc', SURFACES.tsc, ['--help']),
        ];

        // Then - the application and the compiler receive their arguments; only start's own -h is a help
        expect(read).toStrictEqual([
            { args: ['--port', '3000'], kind: 'run' },
            { args: ['serve', '--help', '-h'], kind: 'run' },
            { kind: 'help' },
            { args: ['--help'], kind: 'run' },
        ]);
    });

    test('refuses in four parts a repeated flag, a value missing or joined to a flag that takes none, and a word the command does not read', () => {
        // Given - eleven lines no command runs
        // When - each is read, and its lesson kept
        const lessons = [
            readArguments('mutation', SURFACES.mutation, ['--mutate', 'a:1-2', '--mutate=b:1-2']),
            readArguments('check', SURFACES.check, ['--json', '--json']),
            readArguments('mutation', SURFACES.mutation, ['--since', '--mutate', 'a:1-2']),
            readArguments('mutation', SURFACES.mutation, ['--since=']),
            readArguments('mutation', SURFACES.mutation, ['--since']),
            readArguments('check', SURFACES.check, ['--json=1']),
            readArguments('build', SURFACES.build, ['dist']),
            readArguments('docs-layout', SURFACES['docs-layout'], ['docs', 'extra']),
            readArguments('build', SURFACES.build, ['--watch']),
            readArguments('check', SURFACES.check, ['--watch=all']),
            readArguments('check', SURFACES.check, ['-j=1']),
        ].map((reading) => (reading.kind === 'refused' ? reading.lesson : reading.kind));

        // Then - each lesson names what it found and how to write the line instead
        expect(lessons).toStrictEqual([
            `found: --mutate is given more than once · why: the command reads it once, and a second value would silently replace the first · fix: give it once, every range in one comma-separated value: --mutate src/a.ts:10-20,src/b.ts:1-5 · ${READ}`,
            `found: --json is given more than once · why: the command reads it once, and a line that says it twice was written for another run than this one · fix: give it once: --json · ${READ}`,
            `found: --since has no value · why: a flag read without its value would run the command on another value than the one meant · fix: write it --since <ref> · ${READ}`,
            `found: --since has no value · why: a flag read without its value would run the command on another value than the one meant · fix: write it --since <ref> · ${READ}`,
            `found: --since has no value · why: a flag read without its value would run the command on another value than the one meant · fix: write it --since <ref> · ${READ}`,
            `found: --json takes no value · why: a value the command does not read would be ignored, and the run would not be the one asked for · fix: write it --json, alone · ${READ}`,
            `found: \`typescript build\` was given dist, an argument it does not read · why: an argument the command does not read would be ignored, and the run would not be the one asked for · fix: drop it — \`typescript build\` takes no argument · ${READ}`,
            `found: \`typescript docs-layout\` was given extra, a second <root> · why: an argument the command does not read would be ignored, and the run would not be the one asked for · fix: name one <root>, or none · ${READ}`,
            `found: \`typescript build\` has no flag --watch · why: a flag the command does not read would be ignored, and the run would not be the one asked for · fix: drop it — \`typescript build\` reads no flag · ${READ}`,
            `found: \`typescript check\` has no flag --watch · why: a flag the command does not read would be ignored, and the run would not be the one asked for · fix: drop it — it reads --ignore-pattern <glob>, --json · ${READ}`,
            `found: \`typescript check\` has no flag -j=1 · why: a flag the command does not read would be ignored, and the run would not be the one asked for · fix: drop it — it reads --ignore-pattern <glob>, --json · ${READ}`,
        ]);
    });
});
