import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, onTestFinished, test } from 'vitest';

/*
 * What npm would publish carries `consumer` rules alone: no test file — every
 * meta-test is a `self` rule — and, loaded from the packed tree itself, a
 * rulebook, a catalogue, a check whose every pass the home registry declares
 * `consumer`, and every fragment under `lint/`, all answering to consumers
 * only. The check's internal selector and its registry stay home.
 */

const ROOT = resolve(import.meta.dirname, '../../..');

/** Whether a value is an object whose keys can be read. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** `npm pack`'s answer for this package, parsed: the tarball's name and the paths it holds. */
function pack(...flags: string[]): { filename: string; paths: string[] } {
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

/** The packed tree, extracted beside this checkout's install so its imports resolve. */
function packedTree(): string {
    const destination = mkdtempSync(join(tmpdir(), 'tarball-audience-'));
    onTestFinished(() => {
        rmSync(destination, { force: true, recursive: true });
    });
    const { filename } = pack('--pack-destination', destination);
    const extracted = spawnSync('tar', ['-xzf', filename], { cwd: destination, encoding: 'utf8' });
    if (extracted.status !== 0) {
        throw new Error(`the tarball did not extract: ${extracted.stderr}`);
    }
    symlinkSync(join(ROOT, 'node_modules'), join(destination, 'package/node_modules'));

    return join(destination, 'package');
}

/** A module of the packed tree, imported. */
async function load(tree: string, path: string): Promise<Record<string, unknown>> {
    const module: unknown = await import(pathToFileURL(join(tree, path)).href);
    if (!isRecord(module)) {
        throw new Error(`${path} exports nothing`);
    }
    return module;
}

/** Every `.js` module under the packed tree's `lint/`, as a path from its root. */
function lintModules(tree: string, directory = join(tree, 'lint')): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return lintModules(tree, path);
        }
        return entry.name.endsWith('.js') ? [relative(tree, path)] : [];
    });
}

/** The audiences a list of declarations carries, one per entry. */
function audiencesOf(entries: unknown): unknown[] {
    return (Array.isArray(entries) ? entries : []).map((entry: unknown) =>
        isRecord(entry) ? entry.audience : undefined,
    );
}

test('the tarball carries no test file', () => {
    // Given - every path npm would publish
    const { paths } = pack('--dry-run');
    expect(paths).toContain('lint/_contract.js');

    // Then - no meta-test, no module test and no spec ships, whatever its extension
    expect(
        paths.filter((path) => /\.(?:test|spec)\.[cm]?[jt]sx?$|^specs\//u.test(path)),
    ).toStrictEqual([]);
});

test('the rulebook, the catalogue and the passes the tarball ships are consumer alone', async () => {
    // Given - the packed tree, loaded as a consumer would load it
    const tree = packedTree();
    const oxlint = await load(tree, 'src/oxlint.js');
    const catalogue = await load(tree, 'lint/catalog.js');
    const profiles = await load(tree, 'lint/profiles.js');
    const script = readFileSync(join(tree, 'bin/commands/check.sh'), 'utf8');
    const registry: unknown = JSON.parse(
        readFileSync(join(ROOT, 'src/cli/check-passes.json'), 'utf8'),
    );
    const rows: unknown[] = Array.isArray(registry) ? registry : [];
    const passes = [...script.matchAll(/\bselected (?<pass>[a-z]+)/gu)].map((match) =>
        rows.find((row) => isRecord(row) && row.pass === match.groups?.pass),
    );

    // Then - the published entry loads, and every rule it reaches serves a consumer
    expect(Object.keys(oxlint)).toContain('node');
    expect(
        Object.keys(catalogue).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['catalog', 'unsafeFixers']);
    const entries: unknown =
        typeof catalogue.catalog === 'function'
            ? Reflect.apply(catalogue.catalog, undefined, [])
            : [];
    const fragments = isRecord(profiles.PROFILES)
        ? Object.values(profiles.PROFILES).flatMap((profile) =>
              isRecord(profile) ? profile.fragments : [],
          )
        : [];
    for (const [what, audiences] of Object.entries({
        'catalogue entry': audiencesOf(entries),
        'check pass': audiencesOf(passes),
        'profile fragment': audiencesOf(fragments),
    })) {
        expect(audiences.length, `the tarball ships no ${what}`).toBeGreaterThan(0);
        expect(new Set(audiences), `a ${what} ships that is not consumer`).toStrictEqual(
            new Set(['consumer']),
        );
    }
});

test('the check the tarball ships runs every pass, with no selector of its own', () => {
    // Given - every path npm would publish, and the check script it would carry
    const { paths } = pack('--dry-run');
    const tree = packedTree();
    const script = readFileSync(join(tree, 'bin/commands/check.sh'), 'utf8');

    // Then - the internal selector, its refusal and its registry stay home
    expect(paths).toContain('bin/commands/check.sh');
    expect(
        paths.filter((path) => /check-selection\.sh$|check-passes\.json$/u.test(path)),
    ).toStrictEqual([]);
    expect(script).not.toContain('TYPESCRIPT_CHECK_PASSES');
});

test('every fragment the packed lint/ holds is consumer, whether a profile carries it or not', async () => {
    // Given - every module of the packed lint/, and the fragment each one exports by default
    const tree = packedTree();
    const modules = lintModules(tree);
    expect(modules).toContain('lint/_contract.js');
    const fragments = await Promise.all(
        modules.map(async (path) => {
            const module = await load(tree, path);
            const exported = module.default;
            return isRecord(exported) && 'decisions' in exported
                ? [{ audience: exported.audience, path }]
                : [];
        }),
    );

    // Then - none of them is the package's own discipline
    expect(fragments.flat().length).toBeGreaterThan(15);
    for (const { audience, path } of fragments.flat()) {
        expect.soft(audience, `${path} ships a fragment that is not consumer`).toBe('consumer');
    }
});
