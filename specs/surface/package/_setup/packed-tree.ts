import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { text as streamText } from 'node:stream/consumers';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

import { isRecord, unpackedInto } from '../../../_shared/_setup/packed/pack.js';

const ROOT = resolve(import.meta.dirname, '../../../..');

let unpacked: undefined | { destination: string; tree: string };

export function packedTree(): string {
    if (unpacked !== undefined) {
        return unpacked.tree;
    }
    mkdirSync(join(ROOT, '.artifacts'), { recursive: true });
    const destination = mkdtempSync(join(ROOT, '.artifacts', 'tarball-audience-'));
    const tree = unpackedInto(destination);
    symlinkSync(join(ROOT, 'node_modules'), join(tree, 'node_modules'));
    unpacked = { destination, tree };

    return tree;
}

export function removePackedTree(): void {
    if (unpacked !== undefined) {
        rmSync(unpacked.destination, { force: true, recursive: true });
        unpacked = undefined;
    }
}

export function packedFiles(tree: string, directory = tree): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.name === 'node_modules' && directory === tree) {
            return [];
        }
        return entry.isDirectory() ? packedFiles(tree, path) : [relative(tree, path)];
    });
}

export async function loadPacked(tree: string, path: string): Promise<Record<string, unknown>> {
    const module: unknown = await import(pathToFileURL(join(tree, path)).href);
    if (!isRecord(module)) {
        throw new Error(`${path} exports nothing`);
    }
    return module;
}

function literally(text: string): string {
    return text.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
}

// A `*` matches as Node matches it: one character or more, `/` included, the same text wherever repeated.
function targetsOf(target: unknown, files: string[]): string[] {
    if (typeof target === 'string') {
        const pattern = target.replace(/^\.\//u, '');
        if (!pattern.includes('*')) {
            return [pattern];
        }
        const [first = '', ...rest] = pattern.split('*');
        const matcher = new RegExp(
            `^${literally(first)}(.+)${rest.map((part) => literally(part)).join(String.raw`\1`)}$`,
            'u',
        );
        return files.filter((path) => matcher.test(path));
    }
    if (!isRecord(target)) {
        return [];
    }
    return Object.entries(target).flatMap(([condition, inner]) =>
        condition === 'types' ? [] : targetsOf(inner, files),
    );
}

function manifestOf(tree: string): Record<string, unknown> {
    const manifest: unknown = JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8'));
    return isRecord(manifest) ? manifest : {};
}

export function publishedTargets(tree: string): string[] {
    const { exports: exportsMap } = manifestOf(tree);
    const files = packedFiles(tree);

    return [
        ...new Set(
            Object.values(isRecord(exportsMap) ? exportsMap : {}).flatMap((target) =>
                targetsOf(target, files),
            ),
        ),
    ];
}

export function publishedBins(tree: string): string[] {
    const { bin, name } = manifestOf(tree);
    const commands = typeof bin === 'string' ? { [String(name)]: bin } : isRecord(bin) ? bin : {};

    return Object.values(commands).map((path) => String(path).replace(/^\.\//u, ''));
}

const HEADER = /^ RUN (?<label>.+)$/gmu;

export type Outcome = { passes: string[]; status: number };

export async function checkOutcome(
    bin: string,
    project: string,
    env: Record<string, string>,
    args: string[] = [],
): Promise<Outcome> {
    const base = { ...process.env };
    delete base.TYPESCRIPT_CHECK_PASSES;
    const child = spawn(process.execPath, [bin, 'check', ...args], {
        cwd: project,
        env: { ...base, ...env },
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    const closed: Promise<unknown[]> = once(child, 'close');
    const [printed, [code]] = await Promise.all([streamText(child.stdout), closed]);
    const shown = stripVTControlCharacters(printed);

    return {
        passes: [...shown.matchAll(HEADER)].map((match) => match.groups?.label?.trim() ?? ''),
        status: typeof code === 'number' ? code : -1,
    };
}

const LOCATION = new Set(['HOME', 'INIT_CWD', 'PATH', 'PWD', 'TMPDIR']);

function packedModuleText(tree: string): string {
    return packedFiles(tree)
        .filter((path) => /\.[cm]?js$/u.test(path))
        .map((path) => readFileSync(join(tree, path), 'utf8'))
        .join('\n');
}

function environmentInputs(tree: string): string[] {
    const read = [...packedModuleText(tree).matchAll(/\benv\.(?<name>[A-Za-z_]\w*)/gu)].map(
        (match) => match.groups?.name ?? '',
    );

    return [...new Set(read)].filter((name) => !LOCATION.has(name));
}

const COMMAND = 'dist/command.js';

function commandModules(tree: string): string[] {
    const text = readFileSync(join(tree, COMMAND), 'utf8');
    const reexported = [...text.matchAll(/from\s+["']\.\/(?<module>[^"']+)["']/gu)].map(
        (match) => `dist/${match.groups?.module ?? ''}`,
    );

    return [COMMAND, ...reexported];
}

export function argvFlags(tree: string): string[] {
    const text = commandModules(tree)
        .map((module) => readFileSync(join(tree, module), 'utf8'))
        .join('\n');
    const flags = [...text.matchAll(/["'](?<flag>--[a-z][\w-]*)["']/gu)];

    return [...new Set(flags.map((match) => match.groups?.flag ?? ''))];
}

// The specs' own selection, and every variable the modules read, naming a pass.
export function selectingEnvironments(tree: string): Record<string, Record<string, string>> {
    return {
        'every variable the modules read, naming a pass': Object.fromEntries(
            environmentInputs(tree).map((name) => [name, 'secrets']),
        ),
        "the specs' selection": { TYPESCRIPT_CHECK_PASSES: 'secrets' },
    };
}
