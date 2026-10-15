import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, onTestFinished, test } from 'vitest';

import { objectOf } from '../../../../lint/kit/project/json.js';
import { SOURCES_RAN_SOURCE } from '../sources-ran.js';

function laid(root: string, files: Readonly<Record<string, string>>): void {
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }
}

type SourcesRan = (
    functions: Map<string, number[]>,
    root: string,
    own: string,
) => undefined | { loaded: string[]; ran: string[] };

const isSourcesRan = (value: unknown): value is SourcesRan => typeof value === 'function';

async function sourcesRanIn(): Promise<SourcesRan | undefined> {
    const module = `import { existsSync, readFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
${SOURCES_RAN_SOURCE}
export { sourcesRan };
`;
    const imported: unknown = await import(`data:text/javascript,${encodeURIComponent(module)}`);
    const { sourcesRan } = objectOf(imported);

    return isSourcesRan(sourcesRan) ? sourcesRan : undefined;
}

const BUILT = 'function a(){}\nfunction b(){}\n';

const url = (path: string): string => pathToFileURL(path).href;

const MAP = JSON.stringify({
    mappings: 'AAAA;ACAA',
    names: [],
    sources: ['../src/a.ts', '../src/b.ts'],
    version: 3,
});

describe('SOURCES_RAN_SOURCE', () => {
    test('sources-ran — sourcesRan — names the sources a process ran and loaded, through the build’s map wherever the package was installed, and refuses a copy no map reads', async () => {
        // Given - a sandbox whose build maps two sources, the package installed elsewhere as that build and as another, a dependency, and a source run as it is
        const root = mkdtempSync(join(tmpdir(), 'sources-ran-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const sandbox = join(root, 'sandbox');
        const installed = join(root, 'consumer/node_modules/@scope/package/dist/x.js');
        const stale = join(root, 'stale/node_modules/@scope/package/dist/x.js');
        laid(root, {
            'consumer/node_modules/@scope/package/dist/x.js': BUILT,
            'consumer/node_modules/other/index.js': 'function c(){}',
            'sandbox/dist/x.js': BUILT,
            'sandbox/dist/x.js.map': MAP,
            'sandbox/src/run.ts': 'export {};',
            'stale/node_modules/@scope/package/dist/x.js': 'function z(){}',
        });
        const sourcesRan = await sourcesRanIn();

        // When - each process is read for the function it ran at the second line
        const read = (path: string, offset: number) =>
            sourcesRan?.(new Map([[url(path), [offset]]]), sandbox, '@scope/package');

        // Then - the build's own script and the installed copy read the same; a dependency adds nothing; a source run as it is names itself; a copy of other text names nothing it could be trusted for
        const mapped = { loaded: ['src/a.ts', 'src/b.ts'], ran: ['src/b.ts'] };
        expect([
            read(join(sandbox, 'dist/x.js'), 15),
            read(installed, 15),
            read(join(root, 'consumer/node_modules/other/index.js'), 0),
            read(join(sandbox, 'src/run.ts'), 0),
            read(stale, 0),
        ]).toStrictEqual([
            mapped,
            mapped,
            { loaded: [], ran: [] },
            { loaded: ['src/run.ts'], ran: ['src/run.ts'] },
            undefined,
        ]);
    });
});
