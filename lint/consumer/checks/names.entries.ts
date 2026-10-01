import { basename, dirname, join } from 'node:path';

import type { Context, Finding } from '../../engine/checker/pass.js';
import { defaultSourceOf, outputOf, publishedOf } from '../../engine/project/entry-points.js';
import type { Published } from '../../engine/project/entry-points.js';
import { GROUND_FOLDERS } from '../../engine/project/ground.js';
import { parsedObject } from '../../engine/project/json.js';
import { withoutDotSlash } from '../../engine/project/packed-files.js';
import { namesFinding } from './names.lessons.js';

type Disk = Pick<Context, 'exists' | 'read'>;

type Entry = Published & { source: string };

// tsdown's own lookup order.
const BUILD_CONFIGS = [
    'tsdown.config.ts',
    'tsdown.config.mts',
    'tsdown.config.cts',
    'tsdown.config.js',
    'tsdown.config.mjs',
    'tsdown.config.cjs',
];

const DEFAULT_OUT_DIR = 'dist';

const BUILD_ENTRY =
    /(?:(?:(?<quoted>['"])(?<quotedKey>[^'"]+)\k<quoted>|(?<key>[\w$-]+))\s*:\s*)?['"](?:\.\/)?(?<source>[\w./-]+\.(?:[cm]?ts|tsx))['"]/gu;

const ENTRY_KEYS = new Set(['entry', 'input']);

const SOURCE = /\.(?:[cm]?ts|tsx)$/u;

const TEST = /\.(?:test|spec|test-d|spec-d)(?=\.[cm]?tsx?$)/u;

const ENTRY_ROOTS = new Set(['lint', 'src']);

const GROUND = new RegExp(`(?:^|/)(?:${GROUND_FOLDERS.join('|')})/`, 'u');

const stemOf = (fileName: string): string => fileName.replace(SOURCE, '');

export type BuildMap = { outDir: string; sources: ReadonlyMap<string, string> };

function sourcesOf(text: string): Map<string, string> {
    const sources = new Map<string, string>();
    for (const { groups } of text.matchAll(BUILD_ENTRY)) {
        const source = groups?.source ?? '';
        const key = groups?.quotedKey ?? groups?.key;
        sources.set(
            key === undefined || ENTRY_KEYS.has(key) ? stemOf(basename(source)) : key,
            source,
        );
    }

    return sources;
}

/** What the unit's own build compiles, output name to source; the config is a module a bundler loads, so it is read, never run. */
export function buildMapOf(disk: Disk, unit: string): BuildMap | null {
    const config = BUILD_CONFIGS.find((name) => disk.exists(join(unit, name)));
    if (config === undefined) {
        return null;
    }
    const text = disk.read(join(unit, config)) ?? '';
    const outDir =
        /outDir\s*:\s*['"](?<dir>[^'"]+)['"]/u.exec(text)?.groups?.dir ?? DEFAULT_OUT_DIR;

    return { outDir: withoutDotSlash(outDir).replace(/\/$/u, ''), sources: sourcesOf(text) };
}

const isNamedAsExpected = (source: string, expected: string): boolean =>
    stemOf(basename(source)) === expected;

function grammarFinding(path: string, { stem, target, what }: Published): Finding {
    const variant = stemOf(basename(path)).split('.').includes('node');

    return namesFinding('names/entry-follows-its-grammar', path, {
        fix: `rename it \`${join(dirname(path), stem)}.ts\`, its build entry with it${variant ? ' — `node` is the default runtime and never a variant' : ''}`,
        found: `\`${path}\` builds ${what} (${target}), and is not named \`${stem}.ts\``,
    });
}

function unbuiltFinding(path: string, { target, what }: Published): Finding {
    return namesFinding('names/export-has-an-entry', path, {
        fix: 'name the source it is built from in the build config, or take the subpath out of the manifest',
        found: `${what} is published as ${target}, and no source the build compiles builds it`,
    });
}

function strayBinFinding(path: string): Finding {
    return namesFinding('names/bin-is-published', path, {
        fix: 'name it for what it runs, or publish it: a bin in the manifest named for its command, built from it',
        found: `\`${path}\` is named \`.bin\`, and builds no bin the package publishes`,
    });
}

function strayFinding(path: string): Finding {
    return namesFinding('names/index-is-an-entry', path, {
        fix: 'name it for what it holds, or publish it: a subpath in `exports` built from it',
        found: `\`${path}\` is named \`index\`, and builds nothing the package publishes`,
    });
}

function entriesOf(
    disk: Disk,
    unit: string,
    { build, prefix }: { build: BuildMap | null; prefix: string },
): { entries: Entry[]; findings: Finding[] } {
    let manifest: Record<string, unknown> = {};
    try {
        manifest = parsedObject(disk.read(join(unit, 'package.json')) ?? '{}');
    } catch {
        return { entries: [], findings: [] };
    }
    const outDir = build?.outDir ?? DEFAULT_OUT_DIR;
    const published = publishedOf(manifest, outDir);
    const entries = new Map<string, Entry>();
    const findings: Finding[] = [];
    for (const one of published) {
        const source =
            build === null ? defaultSourceOf(one) : build.sources.get(outputOf(one.target, outDir));
        if (source === undefined || !disk.exists(join(unit, source))) {
            findings.push(unbuiltFinding(`${prefix}package.json`, one));
            continue;
        }
        const entry = { ...one, source };
        const key = `${entry.what}|${String(entry.browser)}|${source}`;
        if (!entries.has(key)) {
            entries.set(key, entry);
        }
    }

    return { entries: [...entries.values()], findings };
}

const isEntryRootModule = (file: string): boolean =>
    SOURCE.test(file) && ENTRY_ROOTS.has(file.split('/')[0] ?? '') && !GROUND.test(file);

const isIndexModule = (file: string): boolean => basename(file).split('.')[0] === 'index';

const isBinModule = (file: string): boolean =>
    stemOf(basename(file.replace(TEST, ''))).endsWith('.bin');

const builds = (file: string, sources: ReadonlySet<string>): boolean => {
    const module = file.replace(TEST, '');

    return [module, module.replace(/\.tsx$/u, '.ts')].some((one) => sources.has(one));
};

export function entryGrammarOf(
    disk: Disk,
    unit: string,
    { files, prefix }: { files: readonly string[]; prefix: string },
): Finding[] {
    const build = buildMapOf(disk, unit);
    const { entries, findings } = entriesOf(disk, unit, { build, prefix });
    if (entries.length === 0 && findings.length === 0) {
        return [];
    }
    const sources = new Set(entries.map(({ source }) => withoutDotSlash(source)));
    const binSources = new Set(
        entries
            .filter(({ stem }) => stem.endsWith('.bin'))
            .map(({ source }) => withoutDotSlash(source)),
    );
    const misnamed = entries
        .filter(({ source, stem }) => !isNamedAsExpected(source, stem))
        .map((entry) => grammarFinding(`${prefix}${withoutDotSlash(entry.source)}`, entry));
    const modules = files.filter((file) => isEntryRootModule(file));
    const strays = modules
        .filter((file) => isIndexModule(file) && !builds(file, sources))
        .map((file) => strayFinding(`${prefix}${file}`));
    const strayBins = modules
        .filter((file) => isBinModule(file) && !builds(file, binSources))
        .map((file) => strayBinFinding(`${prefix}${file}`));

    return [...findings, ...misnamed, ...strays, ...strayBins];
}
