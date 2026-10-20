import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, onTestFinished, test } from 'vitest';

import { IGNORERS_SOURCE, LOG_IGNORER, LOG_REASON } from '../ignorers.js';

const INSTRUMENTER = createRequire(import.meta.url).resolve('@stryker-mutator/instrumenter');

// invariant: the ignorers run as Stryker loads them, a module of their own handed to its instrumenter, which reads what each mutant of a source became.
function statusesByLine(source: string): unknown {
    const folder = mkdtempSync(join(tmpdir(), 'ignorers-'));
    onTestFinished(() => {
        rmSync(folder, { force: true, recursive: true });
    });
    const file = join(folder, 'ignorers.mjs');
    writeFileSync(file, IGNORERS_SOURCE);
    const program = `
const { strykerPlugins } = await import(${JSON.stringify(pathToFileURL(file).href)});
const { Instrumenter } = await import(${JSON.stringify(pathToFileURL(INSTRUMENTER).href)});
const quiet = new Proxy({}, { get: (_, name) => (String(name).startsWith('is') ? () => false : () => undefined) });
const { mutants } = await new Instrumenter(quiet).instrument(
    [{ content: ${JSON.stringify(source)}, mutate: true, name: ${JSON.stringify(join(folder, 'src/priced.ts'))} }],
    { excludedMutations: [], ignorers: strykerPlugins.map(({ value }) => value), noHeader: true, plugins: null },
);
const byLine = {};
for (const { location, status, statusReason } of mutants) {
    const line = location.start.line + 1;
    byLine[line] = [...new Set([...(byLine[line] ?? []), status === 'Ignored' ? statusReason : 'made'])].sort();
}
process.stdout.write(JSON.stringify({ names: strykerPlugins.map(({ kind, name }) => kind + ' ' + name), byLine }));
`;
    const { stdout } = spawnSync(process.execPath, ['--input-type=module', '--eval', program], {
        encoding: 'utf8',
    });

    return JSON.parse(stdout);
}

describe('ignorers', () => {
    test('a statement that only calls a logger is never mutated, the call nor anything it is handed; output and every other call are', () => {
        // Given - a function that logs through console and a named logger, awaits a logger of its own, calls a method of the same name on a store, prints, and decides
        const source = [
            'export async function priced(cents: number, logger: Logger, store: Store, auditLogger: Logger): Promise<string> {',
            "    console.warn('pricing', cents > 0);",
            "    logger.info('priced', cents * 2);",
            "    await this.auditLogger.debug('audited');",
            "    store.info('kept');",
            "    print(cents > 100 ? 'dear' : 'cheap');",
            "    return cents > 100 ? 'dear' : 'cheap';",
            '}',
        ].join('\n');

        // Then - the plugin is declared as Stryker reads it; the three log lines hold only ignored mutants, the store, the print and the decision only mutants a test must answer
        expect(statusesByLine(source)).toStrictEqual({
            byLine: {
                1: ['made'],
                2: [LOG_REASON],
                3: [LOG_REASON],
                4: [LOG_REASON],
                5: ['made'],
                6: ['made'],
                7: ['made'],
            },
            names: [`Ignore ${LOG_IGNORER}`],
        });
    });
});
