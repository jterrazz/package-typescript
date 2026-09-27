import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { readConfig } from './jterrazz-config.js';

async function sectionAt(unit: string): Promise<{ problem: null | string; section: unknown }> {
    const { problem, resolved } = await readConfig(unit, []);

    return { problem, section: resolved.sections.typescript ?? {} };
}

function unitWith(source?: string): string {
    const unit = mkdtempSync(join(tmpdir(), 'jterrazz-config-'));
    onTestFinished(() => {
        rmSync(unit, { force: true, recursive: true });
    });
    writeFileSync(join(unit, 'package.json'), '{ "type": "module" }\n');
    if (source !== undefined) {
        writeFileSync(join(unit, 'jterrazz.config.ts'), source);
    }

    return unit;
}

describe('jterrazz-config', () => {
    test('reads no settings where the unit keeps no file', async () => {
        // Given - a unit with no jterrazz.config.ts
        const unit = unitWith();

        // Then - nothing is declared, and nothing is wrong
        await expect(sectionAt(unit)).resolves.toStrictEqual({
            problem: null,
            section: {},
        });
    });

    test('reads its own section, types stripped, and leaves the others alone', async () => {
        // Given - a typed settings file carrying two packages' sections
        const unit = unitWith(
            "const roots: Record<string, string> = { scripts: 'the release scripts' };\nexport default { test: { strict: true }, typescript: { roots } };\n",
        );

        // Then - the section asked for is the one returned
        await expect(sectionAt(unit)).resolves.toStrictEqual({
            problem: null,
            section: { roots: { scripts: 'the release scripts' } },
        });
    });

    test('reads an absent section as no settings', async () => {
        // Given - a file carrying only another package's section
        const unit = unitWith('export default { test: {} };\n');

        // Then - this package declared nothing
        await expect(sectionAt(unit)).resolves.toStrictEqual({
            problem: null,
            section: {},
        });
    });

    test.each([
        ['export default {;\n', /^does not load — /u],
        [
            "throw new Error('the settings are not ready');\n",
            /^does not load — the settings are not ready$/u,
        ],
        [
            "export const roots = { scripts: 'why' };\n",
            /^exports no settings object as its default/u,
        ],
        [
            "export default { typescript: 'strict' };\n",
            /^holds a `typescript` section that is not an object$/u,
        ],
    ])('names why %j cannot be read', async (source, problem) => {
        // Given - a settings file that does not hold settings
        const unit = unitWith(source);

        // When - this package's section is read
        const read = await sectionAt(unit);

        // Then - nothing is declared, and the problem says why
        expect(read.section).toStrictEqual({});
        expect(read.problem).toMatch(problem);
    });
});
