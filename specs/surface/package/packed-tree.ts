import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * What npm would publish, as a consumer receives it: the paths it lists, and
 * the tree it extracts to — packed once per process, beside this checkout's
 * install so its imports resolve, and removed when the process ends.
 */

const ROOT = resolve(import.meta.dirname, '../../..');

/** Whether a value is an object whose keys can be read. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** `npm pack`'s answer for this package, parsed: the tarball's name and the paths it holds. */
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

/** The packed tree's root, extracted on the first call. */
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

/** Every file the packed tree holds, as a path from its root: the install linked beside it left out. */
export function packedFiles(tree: string, directory = tree): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.name === 'node_modules' && directory === tree) {
            return [];
        }
        return entry.isDirectory() ? packedFiles(tree, path) : [relative(tree, path)];
    });
}

/** A module of the packed tree, imported. */
export async function loadPacked(tree: string, path: string): Promise<Record<string, unknown>> {
    const module: unknown = await import(pathToFileURL(join(tree, path)).href);
    if (!isRecord(module)) {
        throw new Error(`${path} exports nothing`);
    }
    return module;
}

/** Every file an `exports` target names that Node loads, its `*` matched against the tree's files. */
function targetsOf(target: unknown, files: string[]): string[] {
    if (typeof target === 'string') {
        const pattern = target.replace(/^\.\//u, '');
        if (!pattern.includes('*')) {
            return [pattern];
        }
        const [head = '', tail = ''] = pattern.split('*');
        return files.filter(
            (path) =>
                path.startsWith(head) &&
                path.endsWith(tail) &&
                !path.slice(head.length).includes('/'),
        );
    }
    if (!isRecord(target)) {
        return [];
    }
    return Object.entries(target).flatMap(([condition, inner]) =>
        condition === 'types' ? [] : targetsOf(inner, files),
    );
}

/** Every file the packed `exports` map publishes, under every condition Node loads. */
export function publishedTargets(tree: string): string[] {
    const manifest: unknown = JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8'));
    const exportsMap = isRecord(manifest) && isRecord(manifest.exports) ? manifest.exports : {};
    const files = packedFiles(tree);

    return [...new Set(Object.values(exportsMap).flatMap((target) => targetsOf(target, files)))];
}
