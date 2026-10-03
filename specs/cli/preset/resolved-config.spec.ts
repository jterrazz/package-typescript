import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { printConfig, PROFILES } from './_setup/rulebook.js';

// invariant: `~ ` marks a rule the base config leaves to an `overrides` block. Names only: options are the manifest's,
// and a name list survives an upstream option reshuffle. Regenerate with `TEST_UPDATE=1 npm test`.

const EXPECTED = resolve(import.meta.dirname, '_expected');

const GOLDENS: Record<string, string> = {
    astro: 'astro.rules.txt',
    bun: 'bun.rules.txt',
    expo: 'expo.rules.txt',
    next: 'next.rules.txt',
    node: 'node.rules.txt',
    react: 'react.rules.txt',
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

            for (const rule of UNAWAITED_PROMISE_RULES) {
                // Then - the base config denies it, which is what a file inherits
                expect
                    .soft(levelOf(config.rules[rule]), `${name}: ${rule} in the base`)
                    .toBe('deny');

                // Then - and no override relaxes it, so the vitest globs inherit it unchanged
                for (const override of config.overrides ?? []) {
                    expect
                        .soft(
                            override.rules[rule],
                            `${name}: ${rule} under ${override.files.join(', ')}`,
                        )
                        .toBeUndefined();
                }
            }
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
        const golden = resolve(EXPECTED, GOLDENS[name] ?? '');

        if (process.env.TEST_UPDATE === '1') {
            writeFileSync(golden, report);
        }
        expect(report).toBe(readFileSync(golden, 'utf8'));
    });
});
