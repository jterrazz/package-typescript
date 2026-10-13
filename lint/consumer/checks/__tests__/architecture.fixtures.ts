import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { onTestFinished } from 'vitest';

import type { Context } from '../../../kit/checker/pass.js';
import type { Resolution } from '../../../kit/project/preset.js';
import { architecture } from '../architecture.js';

export const READ = 'docs/reference/quality-checks.md#the-architecture-layer-map-pass';

export const LAYER = {
    fix: 'import it through the port',
    from: { path: 'domain' },
    name: 'domain-stays-pure',
    read: 'docs/guides/develop.md#layers',
    to: { path: 'infrastructure' },
    why: 'A domain module never reaches for infrastructure.',
};

function scratch(): string {
    const made = mkdtempSync(join(tmpdir(), 'architecture-'));
    const directory = realpathSync(made);
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    return directory;
}

function resolution(layers: unknown[], problem: null | string = null): Resolution {
    return {
        problem,
        resolved: {
            baseline: [],
            declaration: null,
            laws: [],
            layers,
            names: [],
            optOuts: [],
            own: {},
            presets: [],
            sections: {},
        },
    };
}

export type Setup = {
    files?: string[];
    held?: Record<string, string>;
    layers?: unknown[];
    problem?: null | string;
    said?: string;
    status?: number;
    report?: unknown;
    stand?: 'missing' | 'present';
};

type Run = {
    args: string[];
    asked: (string | undefined)[][];
    config: unknown;
    configPath: string;
    root: string;
    result: Awaited<ReturnType<typeof architecture.check>>;
};

// outside: dependency-cruiser is stood in for by a script that records what it was handed and writes the report the case gives it, so the pass is proved on every report it can be handed.
export async function cruised(setup: Setup): Promise<Run> {
    const root = scratch();
    const bin = scratch();
    for (const [path, text] of Object.entries(setup.held ?? {})) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    if (setup.report !== undefined) {
        writeFileSync(join(bin, 'report.json'), JSON.stringify(setup.report));
    }
    writeFileSync(join(bin, 'said.txt'), setup.said ?? '');
    const stand = join(bin, 'depcruise');
    writeFileSync(
        stand,
        `#!/bin/sh
printf '%s\\n' "$@" > '${bin}/args.txt'
cp "$2" '${bin}/config.json'
[ -f '${bin}/report.json' ] && cp '${bin}/report.json' "$6"
cat '${bin}/said.txt'
exit ${String(setup.status ?? 0)}
`,
    );
    chmodSync(stand, 0o755);
    const asked: (string | undefined)[][] = [];
    const context: Context = {
        config: async () =>
            await Promise.resolve(resolution(setup.layers ?? [LAYER], setup.problem)),
        exists: (path) => existsSync(path),
        files: () => setup.files ?? ['src/a.ts'],
        fix: false,
        has: () => false,
        list: () => null,
        positionals: [],
        read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
        root,
        value: (flag: string, fallback?: string) => {
            asked.push([flag, fallback]);

            return setup.stand === 'missing' ? join(bin, 'nowhere') : stand;
        },
        verbatim: async () => await Promise.resolve([]),
    };
    const result = await architecture.check(context);
    const args = existsSync(join(bin, 'args.txt'))
        ? readFileSync(join(bin, 'args.txt'), 'utf8').trim().split('\n')
        : [];
    const config: unknown = existsSync(join(bin, 'config.json'))
        ? JSON.parse(readFileSync(join(bin, 'config.json'), 'utf8'))
        : null;

    return { args, asked, config, configPath: args[1] ?? '', result, root };
}

export const violation = (
    from: string,
    rule = 'domain-stays-pure',
    to = 'src/infrastructure/store.ts',
): unknown => ({
    from,
    rule: { name: rule },
    to,
});

export const crossed = (rule: string): unknown => violation(`src/${rule}.ts`, rule, 'src/b.ts');

export const dependency = (source: string): unknown => ({
    dependencies: [{ module: '../infrastructure/store', resolved: 'src/infrastructure/store.ts' }],
    source,
});

export const finding = (
    rule: string,
    why: string,
    teaching: { fix: string; read: string },
): unknown => ({
    column: 1,
    line: 1,
    message: `found: \`src/${rule}.ts\` imports \`src/b.ts\` · why: ${why} · fix: ${teaching.fix} · read: ${teaching.read}`,
    path: `src/${rule}.ts`,
    rule: `architecture/${rule}`,
});
