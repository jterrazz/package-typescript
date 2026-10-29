import { execFileSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { parsedObject } from '../../../../../lint/kit/project/json.js';
import { VERDICT_FILE } from '../gate-verdict.js';
import { PROVEN_FOLDER, provenAsked, provenRun, toolchainOf, treesOf } from '../proven.js';
import type { Host } from '../proven.js';

const HOST: Host = {
    arch: 'arm64',
    environment: {},
    node: 'v24.0.0',
    platform: 'darwin',
    toolchain: '11.0.0 build-a',
};

const PINNED_SECONDS = Date.parse('2001-01-01T00:00:00Z') / 1000;

const ASKED = { args: [], cold: false, scope: '', stage: 'test', verdict: false } as const;

function folder(): string {
    const made = realpathSync(mkdtempSync(`${tmpdir()}/proven-`));
    onTestFinished(() => {
        rmSync(made, { force: true, recursive: true });
    });

    return made;
}

function repository(): string {
    const root = folder();
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    writeFileSync(join(root, '.gitignore'), 'node_modules/\n.artifacts/\n');
    writeFileSync(join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
    writeFileSync(join(root, 'index.ts'), 'export const a = 1;\n');
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'node_modules/.package-lock.json'), '{}\n');
    execFileSync('git', ['add', '.'], { cwd: root });

    return root;
}

type Stage = { ran: number; run: () => Promise<number> };

function stage(statuses: readonly number[] = [], effect: () => void = () => {}): Stage {
    const made: Stage = {
        ran: 0,
        run: async () => {
            effect();
            const status = statuses[made.ran] ?? 0;
            made.ran += 1;

            return await Promise.resolve(status);
        },
    };

    return made;
}

describe('proven', () => {
    test('provenRun — the same tree run twice runs once: the second is answered by the green the first left', async () => {
        // Given - a repository whose stage passes
        const root = repository();
        const run = stage();

        // When - the stage runs twice on the same tree
        const statuses = [
            await provenRun(root, ASKED, run.run, HOST),
            await provenRun(root, ASKED, run.run, HOST),
        ];

        // Then - both are green, and only the first ran
        expect(statuses).toStrictEqual([0, 0]);
        expect(run.ran).toBe(1);
        expect(readdirSync(join(root, PROVEN_FOLDER))).toHaveLength(1);
        expect(existsSync(join(root, VERDICT_FILE))).toBe(false);
    });

    test.each([
        [
            'one byte of a tracked file',
            (root: string) => {
                writeFileSync(join(root, 'index.ts'), 'export const a = 2;\n');
            },
        ],
        [
            'a file git does not track yet',
            (root: string) => {
                writeFileSync(join(root, 'added.ts'), 'export const b = 1;\n');
            },
        ],
        [
            'the lockfile',
            (root: string) => {
                writeFileSync(join(root, 'package-lock.json'), '{"lockfileVersion":4}\n');
            },
        ],
        [
            'the install',
            (root: string) => {
                writeFileSync(join(root, 'node_modules/.package-lock.json'), '{"packages":{}}\n');
            },
        ],
        [
            'what the index tracks, the bytes unchanged',
            (root: string) => {
                execFileSync('git', ['rm', '--cached', '--quiet', 'index.ts'], { cwd: root });
            },
        ],
    ])(
        'provenRun — %s changed since the green misses, and the stage runs again',
        async (_case, change) => {
            // Given - a stage proven green on a tree
            const root = repository();
            const run = stage();
            await provenRun(root, ASKED, run.run, HOST);

            // When - one input changes before the next run
            change(root);
            await provenRun(root, ASKED, run.run, HOST);

            // Then - the second run is no hit
            expect(run.ran).toBe(2);
        },
    );

    test.each([
        ['a variable of the list', { NODE_OPTIONS: '--max-old-space-size=4096' }, 2],
        ['the Node version', { node: 'v24.1.0' }, 2],
        ['the toolchain build', { toolchain: '11.0.0 build-b' }, 2],
        ['the platform', { platform: 'linux' }, 2],
        ['a variable outside the list', { UNLISTED: '1' }, 1],
    ] as const)(
        'provenRun — %s changed since the green decides whether the stage runs again',
        async (_case, changed, runs) => {
            // Given - a stage proven green on one host
            const root = repository();
            const run = stage();
            await provenRun(root, ASKED, run.run, HOST);

            // When - the same tree runs on a host that differs by one input
            const host: Host =
                'node' in changed || 'toolchain' in changed || 'platform' in changed
                    ? { ...HOST, ...changed }
                    : { ...HOST, environment: changed };
            await provenRun(root, ASKED, run.run, host);

            // Then - a listed input misses; a variable the key does not read is no input
            expect(run.ran).toBe(runs);
        },
    );

    test('provenRun — a red is never kept: the next run of the same tree runs, and a green after it is kept', async () => {
        // Given - a stage that fails once, then passes
        const root = repository();
        const run = stage([1, 1]);

        // When - it runs four times on one tree
        const statuses = [
            await provenRun(root, ASKED, run.run, HOST),
            await provenRun(root, ASKED, run.run, HOST),
            await provenRun(root, ASKED, run.run, HOST),
            await provenRun(root, ASKED, run.run, HOST),
        ];

        // Then - both reds ran and kept nothing; the green ran and answered the last
        expect(statuses).toStrictEqual([1, 1, 0, 0]);
        expect(run.ran).toBe(3);
    });

    test('provenRun — a run that changes the tree it was asked on keeps no proof, and a cold one runs whatever was kept', async () => {
        // Given - a stage that rewrites a tracked file and passes, then a plain green one
        const root = repository();
        const rewriting = stage([], () => {
            writeFileSync(join(root, 'index.ts'), 'export const a = 3;\n');
        });
        const run = stage();

        // When - the rewrite runs, then the plain stage twice, then cold
        await provenRun(root, ASKED, rewriting.run, HOST);
        await provenRun(root, ASKED, run.run, HOST);
        await provenRun(root, ASKED, run.run, HOST);
        await provenRun(root, { ...ASKED, cold: true }, run.run, HOST);

        // Then - the rewrite proved nothing, the plain stage ran first and cold, and was answered between
        expect(run.ran).toBe(2);
    });

    test('provenRun — outside a repository nothing is proven, so every run runs', async () => {
        // Given - a folder git names no tree for
        const root = folder();
        const run = stage();

        // When - the stage runs twice
        await provenRun(root, ASKED, run.run, HOST);
        await provenRun(root, ASKED, run.run, HOST);

        // Then - both ran
        expect(run.ran).toBe(2);
    });

    test("provenRun — a stage's arguments and scope are in its key, and a hit writes again the verdict the green left", async () => {
        // Given - a gate stage that leaves its verdict, proven green
        const root = repository();
        const asked = {
            args: [],
            cold: false,
            scope: 'config',
            stage: 'check',
            verdict: true,
        } as const;
        const run = stage([], () => {
            mkdirSync(join(root, '.artifacts/gate'), { recursive: true });
            writeFileSync(join(root, VERDICT_FILE), '{"command":"check","passes":[],"status":0}\n');
        });
        await provenRun(root, asked, run.run, HOST);
        rmSync(join(root, VERDICT_FILE));

        // When - the same stage runs again, then with another scope, then with an argument
        await provenRun(root, asked, run.run, HOST);
        const replayed = parsedObject(readFileSync(join(root, VERDICT_FILE), 'utf8'));
        await provenRun(root, { ...asked, scope: 'config,names' }, run.run, HOST);
        await provenRun(root, { ...asked, args: ['--since', 'main'] }, run.run, HOST);

        // Then - the hit wrote the verdict back, and each other key ran
        expect(replayed).toMatchObject({ command: 'check', status: 0 });
        expect(run.ran).toBe(3);
    });

    test('provenRun — a proof names the GitHub run that took it, and a hit on a runner is its cached line', async () => {
        // Given - a stage proven green by run 4077 on a runner, and one proven on a laptop
        const [runner, laptop] = [repository(), repository()];
        const host = { ...HOST, environment: { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '4077' } };
        const run = stage();
        await provenRun(runner, ASKED, run.run, host);
        await provenRun(laptop, ASKED, run.run, HOST);

        // When - the runner's stage runs again
        const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
        await provenRun(runner, ASKED, run.run, host);
        const chunks = write.mock.calls.map(([chunk]) => String(chunk));
        vi.restoreAllMocks();

        // Then - each proof holds its run or none, and the hit printed the stage cached by that run
        const runs = [runner, laptop].map((root) => {
            const [name = ''] = readdirSync(join(root, PROVEN_FOLDER));

            return parsedObject(readFileSync(join(root, PROVEN_FOLDER, name), 'utf8')).run;
        });
        expect(runs).toStrictEqual(['4077', null]);
        expect(run.ran).toBe(2);
        expect(chunks[1]).toMatch(/^tests {9}✓ cached · \d{2}:\d{2} UTC · run 4077\n$/u);
    });

    test('provenRun — keeps the last eight proofs of a stage, the oldest removed first', async () => {
        // Given - another stage proven once, then a stage proven on ten trees, one after the other
        const root = repository();
        await provenRun(root, { ...ASKED, stage: 'check' }, stage().run, HOST);
        const proofs = join(root, PROVEN_FOLDER);
        const written: string[] = [];
        for (const value of Array.from({ length: 10 }, (_unused, index) => index)) {
            writeFileSync(join(root, 'index.ts'), `export const a = ${String(value)};\n`);
            await provenRun(root, ASKED, stage().run, HOST);
            const added = readdirSync(proofs).find(
                (name) => name.startsWith('test-') && !written.includes(name),
            );
            written.push(String(added));
            utimesSync(join(proofs, String(added)), PINNED_SECONDS + value, PINNED_SECONDS + value);
        }

        // Then - the eight newest of the stage remain, beside the other stage's own
        const kept = readdirSync(proofs);
        expect([
            kept.filter((name) => name.startsWith('test-')).toSorted(),
            kept.filter((name) => name.startsWith('check-')).length,
        ]).toStrictEqual([written.slice(2).toSorted(), 1]);
    });

    test('provenAsked — `--cold` asks a run and is no input of the key, and only the gate stages carry their verdict', () => {
        // Given - a cold check with its passes, a cold mutation since main, a plain test
        const lines = [
            provenAsked('check', ['--cold'], 'config,names'),
            provenAsked('mutation', ['--since', 'main', '--cold']),
            provenAsked('test', []),
        ];

        // Then - each stage's line read
        expect(lines).toStrictEqual([
            { args: [], cold: true, scope: 'config,names', stage: 'check', verdict: true },
            { args: ['--since', 'main'], cold: true, scope: '', stage: 'mutation', verdict: true },
            { args: [], cold: false, scope: '', stage: 'test', verdict: false },
        ]);
    });

    test('treesOf — names the tree without touching the index git keeps', () => {
        // Given - a repository with a file git does not track
        const root = repository();
        writeFileSync(join(root, 'added.ts'), 'export const b = 1;\n');
        const index = readFileSync(join(root, '.git/index'));

        // When - the trees are named
        const trees = treesOf(root);

        // Then - two tree ids, and the index unchanged byte for byte
        expect(trees).toMatch(/^[\da-f]{40} [\da-f]{40}$/u);
        expect(readFileSync(join(root, '.git/index')).equals(index)).toBe(true);
    });

    test('treesOf — names no tree where git cannot write one: a merge in conflict, or a file it cannot read', () => {
        // Given - a repository whose merge stopped on a conflict, and one holding a file nobody may read
        const merging = repository();
        const commit = (message: string): void => {
            execFileSync(
                'git',
                [
                    '-c',
                    'user.email=t@t',
                    '-c',
                    'user.name=t',
                    'commit',
                    '--quiet',
                    '--all',
                    '--message',
                    message,
                ],
                { cwd: merging },
            );
        };
        commit('first');
        execFileSync('git', ['switch', '--quiet', '--create', 'other'], { cwd: merging });
        writeFileSync(join(merging, 'index.ts'), 'export const a = 2;\n');
        commit('other');
        execFileSync('git', ['switch', '--quiet', '-'], { cwd: merging });
        writeFileSync(join(merging, 'index.ts'), 'export const a = 3;\n');
        commit('mine');
        const merge = (() => {
            try {
                execFileSync(
                    'git',
                    ['-c', 'user.email=t@t', '-c', 'user.name=t', 'merge', '--quiet', 'other'],
                    {
                        cwd: merging,
                        stdio: 'ignore',
                    },
                );

                return 'merged';
            } catch {
                return 'conflict';
            }
        })();
        const unreadable = repository();
        writeFileSync(join(unreadable, 'secret.ts'), 'export const s = 1;\n');
        chmodSync(join(unreadable, 'secret.ts'), 0o000);
        onTestFinished(() => {
            chmodSync(join(unreadable, 'secret.ts'), 0o644);
        });

        // Then - neither has a tree to key a proof on
        expect([merge, treesOf(merging), treesOf(unreadable)]).toStrictEqual([
            'conflict',
            undefined,
            undefined,
        ]);
    });

    test('toolchainOf — the version and every built file but the maps', () => {
        // Given - a built toolchain, then the same with a map rewritten, then a module rewritten
        const root = folder();
        mkdirSync(join(root, 'dist/chunks'), { recursive: true });
        writeFileSync(join(root, 'package.json'), '{"version":"11.0.0"}\n');
        writeFileSync(join(root, 'dist/command.js'), 'export {};\n');
        writeFileSync(join(root, 'dist/chunks/a.js'), 'export const a = 1;\n');
        writeFileSync(join(root, 'dist/command.js.map'), '{}\n');
        const first = toolchainOf(join(root, 'dist'));
        writeFileSync(join(root, 'dist/command.js.map'), '{"version":3}\n');
        const mapOnly = toolchainOf(join(root, 'dist'));
        writeFileSync(join(root, 'dist/chunks/a.js'), 'export const a = 2;\n');

        // Then - the map changes nothing, the module does
        expect(first).toMatch(/^11\.0\.0 [\da-f]{64}$/u);
        expect(mapOnly).toBe(first);
        expect(toolchainOf(join(root, 'dist'))).not.toBe(first);
    });
});
