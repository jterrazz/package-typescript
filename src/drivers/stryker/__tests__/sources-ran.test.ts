import { execFileSync } from 'node:child_process';
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
    const module = `import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

        // Then - the build's own script and the installed copy read the same; a dependency adds nothing; a source run as it is names itself, as ran only where a function of it ran; a copy of other text names nothing it could be trusted for
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
        const bodyOnly = new Map([[url(join(sandbox, 'src/run.ts')), []]]);
        expect(sourcesRan?.(bodyOnly, sandbox, '@scope/package')).toStrictEqual({
            loaded: ['src/run.ts'],
            ran: [],
        });
    });

    test('sources-ran — sourcesRan — a facade git does not list names nothing, wherever it was installed, and a listed one is a source', async () => {
        // Given - a sandbox git lists, whose build leaves an entry that only re-exports a mapped chunk, beside a listed source that only re-exports, and the package installed elsewhere with that entry
        const root = mkdtempSync(join(tmpdir(), 'sources-ran-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const sandbox = join(root, 'sandbox');
        const FACADE =
            'import { a as one } from "./x.js";\nexport { one };\nexport * from "./x.js";\n';
        laid(root, {
            'consumer/node_modules/@scope/package/dist/entry.js': FACADE,
            'sandbox/.gitignore': 'dist/\n',
            'sandbox/dist/entry.js': FACADE,
            'sandbox/dist/x.js': BUILT,
            'sandbox/dist/x.js.map': MAP,
            'sandbox/src/index.js': "export { a } from './a.js';\nimport './b.js';\n",
        });
        execFileSync('git', ['init', '--quiet'], { cwd: sandbox });
        execFileSync('git', ['add', '--all'], { cwd: sandbox });
        const sourcesRan = await sourcesRanIn();

        // When - each process is read for the facade it loaded, and for the chunk's second function
        const read = (paths: readonly string[]) =>
            sourcesRan?.(
                new Map(paths.map((path, index) => [url(path), [index === 0 ? 0 : 15]])),
                sandbox,
                '@scope/package',
            );

        // Then - the entry and its installed copy add nothing to what the chunk names; the listed re-export names itself
        expect([
            read([join(sandbox, 'dist/entry.js'), join(sandbox, 'dist/x.js')]),
            read([join(root, 'consumer/node_modules/@scope/package/dist/entry.js')]),
            read([join(sandbox, 'src/index.js')]),
        ]).toStrictEqual([
            { loaded: ['src/a.ts', 'src/b.ts'], ran: ['src/b.ts'] },
            { loaded: [], ran: [] },
            { loaded: ['src/index.js'], ran: ['src/index.js'] },
        ]);
    });
});
