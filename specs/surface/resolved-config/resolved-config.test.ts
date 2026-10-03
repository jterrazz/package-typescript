import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { printConfig, PROFILES } from '../../_shared/_setup/rulebook.js';

// invariant: `~ ` marks a rule the base config leaves to an `overrides` block. Names only: options are the manifest's,
// and a name list survives an upstream option reshuffle. Regenerate with `TEST_UPDATE=1 npm test`.

const HERE = import.meta.dirname;

const GOLDENS: Record<string, string> = {
    astro: '_expected/astro.rules.txt',
    bun: '_expected/bun.rules.txt',
    expo: '_expected/expo.rules.txt',
    next: '_expected/next.rules.txt',
    node: '_expected/node.rules.txt',
    react: '_expected/react.rules.txt',
};

const MARKERS: Record<string, string> = { allow: '- ', deny: '', warn: '~ ' };

function levelOf(entry: unknown): string {
    return Array.isArray(entry) ? String(entry[0]) : String(entry);
}

// hazard: `expect.element(…)` and every async matcher return a promise: a spec that forgets `await` passes by not asserting.
const UNAWAITED_PROMISE_RULES = [
    'typescript/await-thenable',
    'typescript/no-floating-promises',
    'typescript/no-misused-promises',
];

function sectionOf(label: string, section: Record<string, unknown> = {}): string {
    const pairs = Object.entries(section)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${String(value)}`);

    return `${label} ${pairs.join(' ')}`.trimEnd();
}

describe('resolved-config', () => {
    test.each(PROFILES)(
        '$name arms the un-awaited-promise rules on a test file too',
        ({ name }) => {
            // Given - the profile, resolved by oxlint itself
            const config = printConfig(name);

            // Then - the base config denies each, which is what a file inherits
            expect(
                UNAWAITED_PROMISE_RULES.filter((rule) => levelOf(config.rules[rule]) !== 'deny'),
            ).toStrictEqual([]);

            // Then - and no override relaxes one, so the vitest globs inherit it unchanged
            expect(
                (config.overrides ?? []).flatMap((override) =>
                    UNAWAITED_PROMISE_RULES.filter(
                        (rule) => override.rules[rule] !== undefined,
                    ).map((rule) => `${rule} under ${override.files.join(', ')}`),
                ),
            ).toStrictEqual([]);
        },
    );

    test.each(PROFILES)('$name resolves to the rule set its golden records', ({ name }) => {
        // Given - the profile, resolved by oxlint itself
        const { env, globals, options, rules } = printConfig(name);

        // Then - its environments, globals and options, then the sorted roster, match the golden marker by marker
        const header = [
            sectionOf('env', env),
            sectionOf('globals', globals),
            sectionOf('options', options),
        ].join('\n');
        const report = `${header}\n\n${Object.keys(rules)
            .toSorted((left, right) => left.localeCompare(right))
            .map((rule) => `${MARKERS[levelOf(rules[rule])] ?? '? '}${rule}`)
            .join('\n')}\n`;
        const golden = resolve(HERE, GOLDENS[name] ?? '');

        if (process.env.TEST_UPDATE === '1') {
            writeFileSync(golden, report);
        }
        expect(report).toBe(readFileSync(golden, 'utf8'));
    });
});
