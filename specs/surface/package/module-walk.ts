import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, execPath } from 'node:process';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

// The child runs under Node with types stripped, so this file imports nothing of the repository; the process's
// exit is refused and the module gets a bare command line in an empty directory.

export type DeclaredFragment = {
    fragment: Record<string, unknown>;
    path: string;
};

export type WalkedFragment = { audience: unknown; id: unknown; path: string };

const BUILT = '@jterrazz/typescript/module-walk';

const BUILDER = /^export function fragment\(/mu;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFragment(value: unknown): value is Record<string, unknown> {
    return isRecord(value) && 'decisions' in value && 'id' in value;
}

export function fragmentsIn(
    value: unknown,
    path: string,
    seen = new Set<unknown>(),
): DeclaredFragment[] {
    if (!isRecord(value) || seen.has(value)) {
        return [];
    }
    seen.add(value);
    const own = isFragment(value) ? [{ fragment: value, path }] : [];

    return [
        ...own,
        ...Object.entries(value).flatMap(([key, inner]) =>
            fragmentsIn(inner, `${path}.${key}`, seen),
        ),
    ];
}

async function walkOne(tree: string, module: string, scratch: string): Promise<WalkedFragment[]> {
    const report = join(scratch, `${module.replaceAll('/', '__')}.json`);
    const cwd = mkdtempSync(join(scratch, 'cwd-'));
    const child = spawn(execPath, [import.meta.filename, tree, module, report], {
        cwd,
        stdio: 'ignore',
        timeout: 20_000,
    });
    const closed: unknown[] = await once(child, 'close');
    const [code, signal] = closed;
    try {
        const walked: unknown = JSON.parse(readFileSync(report, 'utf8'));
        const entries: unknown[] = Array.isArray(walked) ? walked : [];
        return entries.filter(
            (entry): entry is WalkedFragment => isRecord(entry) && typeof entry.path === 'string',
        );
    } catch {
        throw new Error(`${module} was not walked: the child ended ${String(code ?? signal)}`);
    }
}

export async function walkModules(
    tree: string,
    modules: string[],
): Promise<{ fragments: WalkedFragment[]; walked: string[] }> {
    const scratch = mkdtempSync(join(tmpdir(), 'module-walk-'));
    const queue = [...modules];
    const fragments: WalkedFragment[] = [];
    const walked: string[] = [];
    const drain = async (): Promise<void> => {
        const module = queue.shift();
        if (module === undefined) {
            return;
        }
        fragments.push(...(await walkOne(tree, module, scratch)));
        walked.push(module);
        await drain();
    };
    try {
        await Promise.all(Array.from({ length: availableParallelism() }, drain));
    } finally {
        rmSync(scratch, { force: true, recursive: true });
    }
    return { fragments, walked };
}

function sourceText(source: unknown): string {
    if (typeof source === 'string') {
        return source;
    }
    return source instanceof Uint8Array || source instanceof ArrayBuffer
        ? new TextDecoder().decode(source)
        : '';
}

async function walkHere(tree: string, module: string, report: string): Promise<void> {
    const built: unknown[] = [];
    const treeUrl = pathToFileURL(realpathSync(tree)).href;
    Reflect.set(globalThis, Symbol.for(BUILT), built);
    registerHooks({
        load(url, context, nextLoad) {
            const loaded = nextLoad(url, context);
            const source = sourceText(loaded.source);
            if (!url.startsWith(treeUrl) || !BUILDER.test(source)) {
                return loaded;
            }
            return {
                ...loaded,
                source: `${source}\nfragment = ((build) => function recorded(definition) { const made = build(definition); globalThis[Symbol.for(${JSON.stringify(BUILT)})].push(made); return made; })(fragment);\n`,
            };
        },
    });
    const exit = process.exit.bind(process);
    process.exit = (code) => {
        throw new Error(`exit ${String(code)}`);
    };
    syncBuiltinESMExports();
    process.on('uncaughtException', () => {});
    process.on('unhandledRejection', () => {});
    argv.splice(1, argv.length - 1, join(tree, module));

    let exported: unknown = {};
    try {
        exported = await import(pathToFileURL(join(tree, module)).href);
    } catch {
        // A module that exits or throws on import still reports what it built before.
    }
    await nextTurn();
    const seen = new Set<unknown>();
    const reached = [
        ...(isRecord(exported)
            ? Object.entries(exported).flatMap(([name, value]) =>
                  fragmentsIn(value, `${module}#${name}`, seen),
              )
            : []),
        ...built.flatMap((fragment) => fragmentsIn(fragment, `${module} (built on import)`, seen)),
    ];
    writeFileSync(
        report,
        JSON.stringify(
            reached.map(({ fragment, path }) => ({
                audience: fragment.audience,
                id: fragment.id,
                path,
            })),
        ),
    );
    exit(0);
}

if (import.meta.main) {
    const [tree = '', module = '', report = ''] = argv.slice(2);
    await walkHere(tree, module, report);
}
