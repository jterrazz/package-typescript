import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { text as streamText } from 'node:stream/consumers';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

// Packed beside this checkout's install so its imports resolve, and removed when the process ends.

const ROOT = resolve(import.meta.dirname, '../../../..');

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function pack(...flags: string[]): { filename: string; paths: string[] } {
    const run = spawnSync('npm', ['pack', '--json', '--ignore-scripts', ...flags], {
        cwd: ROOT,
        encoding: 'utf8',
    });
    if (run.status !== 0) {
        throw new Error(`npm pack failed: ${run.stderr}`);
    }
    // npm 10 prints one report per package in an array, npm 12 keys them by name.
    const printed: unknown = JSON.parse(run.stdout);
    const reports: unknown[] = Array.isArray(printed)
        ? printed
        : Object.values(isRecord(printed) ? printed : {});
    const [report] = reports;
    if (!isRecord(report) || typeof report.filename !== 'string' || !Array.isArray(report.files)) {
        throw new Error(`npm pack printed no report: ${run.stdout}`);
    }
    const files: unknown[] = report.files;

    return {
        filename: report.filename,
        paths: files.map((file) => (isRecord(file) ? String(file.path) : '')),
    };
}

let extracted: string | undefined;

export function packedTree(): string {
    if (extracted !== undefined) {
        return extracted;
    }
    const destination = mkdtempSync(join(tmpdir(), 'tarball-audience-'));
    process.once('exit', () => {
        rmSync(destination, { force: true, recursive: true });
    });
    const { filename } = pack('--pack-destination', destination);
    const run = spawnSync('tar', ['-xzf', filename], { cwd: destination, encoding: 'utf8' });
    if (run.status !== 0) {
        throw new Error(`the tarball did not extract: ${run.stderr}`);
    }
    extracted = join(destination, 'package');
    symlinkSync(join(ROOT, 'node_modules'), join(extracted, 'node_modules'));

    return extracted;
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

export function argvFlags(tree: string): string[] {
    const flags = [
        ...readFileSync(join(tree, 'dist/command.js'), 'utf8').matchAll(
            /["'](?<flag>--[a-z][\w-]*)["']/gu,
        ),
    ];

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
