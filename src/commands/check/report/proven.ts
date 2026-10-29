import { createHash } from 'node:crypto';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { hostname, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';

import { ARTIFACTS } from '../../../../lint/kit/project/build-plan.js';
import { git } from '../../../../lint/kit/project/git.js';
import { isJsonObject, parsedObject } from '../../../../lint/kit/project/json.js';
import type { JsonObject } from '../../../../lint/kit/project/json.js';
import { chromiumBuilds } from '../../doctor/browsers.js';
import { badge, GREEN, print, RESET } from '../../terminal.js';
import { ciCachedPrinted } from './ci-cached.js';
import { headOf, VERDICT_FILE } from './gate-verdict.js';
import { onGitHub } from './workflow-commands.js';

/** Where a green verdict is kept, one file per stage and key, from the project's root. */
export const PROVEN_FOLDER = `${ARTIFACTS}/proven`;

/** The variables whose value changes what a stage decides, each read into its key; a variable outside the list is the residual risk ADR-033 names. */
export const PROVEN_ENVIRONMENT = [
    'CI',
    'GITHUB_ACTIONS',
    'NODE_ENV',
    'NODE_OPTIONS',
    'PLAYWRIGHT_BROWSERS_PATH',
    'TEST_UPDATE',
    'TZ',
] as const;

const KEPT_PER_STAGE = 8;

const LOCKFILES = ['package-lock.json', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock'] as const;

const INSTALLS = ['node_modules/.package-lock.json', 'node_modules/.modules.yaml'] as const;

export type ProvenStage = 'check' | 'mutation' | 'test';

/** What the machine running a stage brings to its verdict: the runtime, the toolchain build, the environment. */
export type Host = {
    arch: string;
    environment: Readonly<Record<string, string | undefined>>;
    node: string;
    platform: string;
    toolchain: string;
};

/** The stage asked, its own arguments, and what else its verdict reads (the passes `check` selected, the tree `mutation` measures against). */
export type Asked = {
    args: readonly string[];
    scope: string;
    stage: ProvenStage;
};

/** What a stage's line asks of its proof: `--cold` runs it whatever proof it holds, and is no input of the key; `check` and `mutation` leave the gate's verdict file, which a proof carries. */
export const provenAsked = (
    stage: ProvenStage,
    args: readonly string[],
    scope = '',
): Asked & { cold: boolean; verdict: boolean } => ({
    args: args.filter((argument) => argument !== '--cold'),
    cold: args.includes('--cold'),
    scope,
    stage,
    verdict: stage !== 'test',
});

export type Inputs = Readonly<Record<string, string>>;

type Proof = {
    at: string;
    inputs: Inputs;
    key: string;
    run: null | string;
    stage: ProvenStage;
    verdict: JsonObject | null;
    where: string;
};

const hashOf = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

const gitIndexed = (cwd: string, args: readonly string[], index: string): string | undefined =>
    git(cwd, args, undefined, { GIT_INDEX_FILE: index })?.trim();

/** The tree the index holds and the tree of every file git does not ignore, both written from a copy of the index so the checkout's own is never touched; `undefined` outside a repository or where git cannot write them. */
export function treesOf(project: string): string | undefined {
    const located = git(project, ['rev-parse', '--show-toplevel', '--git-path', 'index']);
    if (located === undefined) {
        return undefined;
    }
    const [top = '', index = ''] = located.split('\n');
    const scratch = mkdtempSync(join(tmpdir(), 'typescript-proven-'));
    const copy = join(scratch, 'index');
    try {
        const indexFile = resolve(project, index);
        // hazard: git trusts an entry whose file is older than the index it reads, so the copy keeps the index's own times, else a same-size edit made in the second of the last `git add` reads as unchanged.
        if (existsSync(indexFile)) {
            copyFileSync(indexFile, copy);
            const { atime, mtime } = statSync(indexFile);
            utimesSync(copy, atime, mtime);
        }
        const indexed = gitIndexed(top, ['write-tree'], copy);
        const added = gitIndexed(top, ['add', '--all', '--', '.'], copy);
        const working = added === undefined ? undefined : gitIndexed(top, ['write-tree'], copy);

        return indexed === undefined || working === undefined ? undefined : `${indexed} ${working}`;
    } finally {
        rmSync(scratch, { force: true, recursive: true });
    }
}

function fileHashOf(project: string, names: readonly string[]): string {
    const found = names.find((name) => existsSync(join(project, name)));

    return found === undefined ? 'none' : `${found} ${hashOf(readFileSync(join(project, found)))}`;
}

function filesUnder(folder: string): string[] {
    return readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
        .map((entry) => join(entry.parentPath, entry.name))
        .toSorted();
}

/** The toolchain build that runs: its version and the hash of every file of its `dist/`, maps aside. */
export function toolchainOf(dist: string): string {
    const manifest = readFileSync(join(dirname(dist), 'package.json'), 'utf8');
    const { version } = parsedObject(manifest);
    const hash = createHash('sha256');
    for (const file of filesUnder(dist)) {
        hash.update(relative(dist, file)).update('\0').update(readFileSync(file)).update('\0');
    }

    return `${String(version)} ${hash.digest('hex')}`;
}

const runningDist = (): string => dirname(createRequire(import.meta.url).resolve('#command'));

export const hostNow = (): Host => ({
    arch: process.arch,
    environment: process.env,
    node: process.version,
    platform: process.platform,
    toolchain: toolchainOf(runningDist()),
});

function browsersOf(project: string): string {
    const builds = chromiumBuilds(project);

    return builds === undefined
        ? 'none'
        : builds
              .map(
                  ({ installed, name, revision }) =>
                      `${name}-${revision} ${installed ? 'installed' : 'absent'}`,
              )
              .join(', ');
}

const environmentOf = (environment: Host['environment']): string =>
    JSON.stringify(Object.fromEntries(PROVEN_ENVIRONMENT.map((name) => [name, environment[name]])));

/** Everything a stage's verdict is keyed on, or `undefined` where the tree cannot be named, so nothing is proven there. */
export function inputsOf(project: string, asked: Asked, host: Host): Inputs | undefined {
    const trees = treesOf(project);
    if (trees === undefined) {
        return undefined;
    }

    return {
        args: asked.args.join(' '),
        browsers: browsersOf(project),
        environment: environmentOf(host.environment),
        install: fileHashOf(project, INSTALLS),
        lockfile: fileHashOf(project, LOCKFILES),
        node: host.node,
        platform: `${host.platform}-${host.arch}`,
        scope: asked.scope,
        stage: asked.stage,
        toolchain: host.toolchain,
        trees,
    };
}

export const keyOf = (inputs: Inputs): string => hashOf(JSON.stringify(inputs));

const proofFile = (project: string, stage: ProvenStage, key: string): string =>
    join(project, PROVEN_FOLDER, `${stage}-${key}.json`);

function proofOf(project: string, stage: ProvenStage, inputs: Inputs): Proof | undefined {
    const key = keyOf(inputs);
    const file = proofFile(project, stage, key);
    if (!existsSync(file)) {
        return undefined;
    }
    const proof = parsedObject(readFileSync(file, 'utf8'));
    const { at, where } = proof;
    const same = JSON.stringify(proof.inputs) === JSON.stringify(inputs);
    const run = typeof proof.run === 'string' ? proof.run : null;
    const verdict = isJsonObject(proof.verdict) ? proof.verdict : null;

    return same && typeof at === 'string' && typeof where === 'string'
        ? { at, inputs, key, run, stage, verdict, where }
        : undefined;
}

function verdictRead(project: string): JsonObject | null {
    const file = join(project, VERDICT_FILE);

    return existsSync(file) ? parsedObject(readFileSync(file, 'utf8')) : null;
}

function pruned(project: string, stage: ProvenStage): void {
    const folder = join(project, PROVEN_FOLDER);
    const proofs = readdirSync(folder)
        .filter((name) => name.startsWith(`${stage}-`))
        .map((name) => ({
            file: join(folder, name),
            modified: statSync(join(folder, name)).mtimeMs,
        }))
        .toSorted((left, right) => right.modified - left.modified);
    for (const { file } of proofs.slice(KEPT_PER_STAGE)) {
        // Stryker disable next-line BooleanLiteral: every proof the prune lists exists, and force spares only a concurrent prune's race
        rmSync(file, { force: true });
    }
}

function recorded(project: string, proof: Proof): void {
    const file = proofFile(project, proof.stage, proof.key);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(proof, null, 4)}\n`);
    pruned(project, proof.stage);
}

function replayed(project: string, proof: Proof, verdict: boolean, host: Host): void {
    if (verdict && proof.verdict !== null) {
        const file = join(project, VERDICT_FILE);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(
            file,
            `${JSON.stringify({ ...proof.verdict, head: headOf(project) }, null, 4)}\n`,
        );
    }
    if (onGitHub(host.environment)) {
        ciCachedPrinted({ ...proof, passes: proof.verdict?.passes }, project, host.environment);
    } else {
        print(
            `${badge('TYPESCRIPT')} ${GREEN}✓ Proven green: this tree passed \`typescript ${proof.stage}\` at ${proof.at} on ${proof.where}, and no input of its key changed since (${PROVEN_FOLDER}/${proof.stage}-${proof.key.slice(0, 12)}…); nothing ran, and --cold runs it again${RESET}\n`,
        );
    }
}

/** Runs a stage unless a green verdict holds for exactly its inputs; a run that ends green on a tree it did not change is kept as that proof, a red one never. `verdict` names a stage that leaves `.artifacts/gate/verdict.json`, which a proof carries and a hit writes again. */
export async function provenRun(
    project: string,
    { cold, verdict, ...asked }: Asked & { cold: boolean; verdict: boolean },
    run: () => Promise<number>,
    host: Host = hostNow(),
): Promise<number> {
    const before = inputsOf(project, asked, host);
    const proof = before === undefined || cold ? undefined : proofOf(project, asked.stage, before);
    if (proof !== undefined) {
        replayed(project, proof, verdict, host);

        return 0;
    }
    const status = await run();
    if (status !== 0 || before === undefined) {
        return status;
    }
    const after = inputsOf(project, asked, host);
    if (after !== undefined && keyOf(after) === keyOf(before)) {
        recorded(project, {
            at: new Date().toISOString(),
            inputs: before,
            key: keyOf(before),
            run: host.environment.GITHUB_RUN_ID ?? null,
            stage: asked.stage,
            verdict: verdict ? verdictRead(project) : null,
            where: `${hostname()} (${project})`,
        });
    }

    return status;
}
