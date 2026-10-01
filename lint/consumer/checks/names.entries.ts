import { basename, dirname, join } from 'node:path';

import type { Context, Finding } from '../../engine/checker/pass.js';
import { GROUND_FOLDERS } from '../../engine/project/ground.js';
import { isJsonObject, parsedObject } from '../../engine/project/json.js';
import { withoutDotSlash } from '../../engine/project/packed-files.js';
import { namesFinding } from './names.lessons.js';

type Disk = Pick<Context, 'exists' | 'read'>;

type Published = { browser: boolean; target: string; what: string };

type Entry = Published & { expected: string; source: string };

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

const BUILT = /\.(?:d\.[cm]?ts|[cm]?js)$/u;

const DECLARATION = /\.d\.[cm]?ts$/u;

const TEST = /\.(?:test|spec|test-d|spec-d)(?=\.[cm]?tsx?$)/u;

const ENTRY_ROOTS = new Set(['lint', 'src']);

const GROUND = new RegExp(`(?:^|/)(?:${GROUND_FOLDERS.join('|')})/`, 'u');

const BIN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.bin$/u;

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

function publishedOf(value: unknown, what: string, browser: boolean): Published[] {
    if (typeof value === 'string') {
        return [{ browser, target: value, what }];
    }
    if (Array.isArray(value)) {
        return value.flatMap((one) => publishedOf(one, what, browser));
    }
    if (!isJsonObject(value)) {
        return [];
    }

    return Object.entries(value).flatMap(([key, nested]) =>
        key.startsWith('.')
            ? publishedOf(nested, `\`${key}\``, false)
            : publishedOf(nested, what, browser || key === 'browser'),
    );
}

function binsOf(bin: unknown, name: string): Published[] {
    if (typeof bin === 'string') {
        return [
            { browser: false, target: bin, what: `the bin \`${name.replace(/^@[^/]+\//u, '')}\`` },
        ];
    }

    return isJsonObject(bin)
        ? Object.entries(bin).flatMap(([command, target]) =>
              typeof target === 'string'
                  ? [{ browser: false, target, what: `the bin \`${command}\`` }]
                  : [],
          )
        : [];
}

function expectedOf({ browser, what }: Published): string {
    if (what.startsWith('the bin')) {
        return '<name>.bin';
    }
    const subpath = what.slice(1, -1);
    const parts = subpath === '.' ? [] : withoutDotSlash(subpath).split('/');

    return ['index', ...parts, ...(browser ? ['browser'] : [])].join('.');
}

const isNamedAsExpected = (source: string, expected: string): boolean => {
    const stem = stemOf(basename(source));

    return expected === '<name>.bin' ? BIN.test(stem) : stem === expected;
};

function grammarFinding(path: string, { expected, target, what }: Entry): Finding {
    const stem = stemOf(basename(path));
    const variant = stem.split('.').includes('node');

    return namesFinding('names/entry-follows-its-grammar', path, {
        fix:
            expected === '<name>.bin'
                ? `rename it \`${join(dirname(path), stem.split('.').at(-1) ?? stem)}.bin.ts\`, its build entry with it`
                : `rename it \`${join(dirname(path), expected)}.ts\`, its build entry with it${variant ? ' — `node` is the default runtime and never a variant' : ''}`,
        found: `\`${path}\` builds ${what} (${target}), and is not named \`${expected}.ts\``,
    });
}

function unbuiltFinding(path: string, { target, what }: Published): Finding {
    return namesFinding('names/export-has-an-entry', path, {
        fix: 'name the source it is built from in the build config, or take the subpath out of the manifest',
        found: `${what} is published as ${target}, and no source the build compiles builds it`,
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
    const published = [
        ...publishedOf(manifest.exports, '`.`', false),
        ...publishedOf(manifest.main, '`.`', false),
        ...binsOf(manifest.bin, typeof manifest.name === 'string' ? manifest.name : ''),
    ]
        .filter(
            ({ target }) =>
                withoutDotSlash(target).startsWith(`${outDir}/`) &&
                BUILT.test(target) &&
                !target.includes('*'),
        )
        .toSorted(
            (left, right) =>
                Number(DECLARATION.test(left.target)) - Number(DECLARATION.test(right.target)),
        );
    const entries = new Map<string, Entry>();
    const findings: Finding[] = [];
    for (const one of published) {
        const out = withoutDotSlash(one.target)
            .slice(outDir.length + 1)
            .replace(BUILT, '');
        const source = build === null ? `src/${out}.ts` : build.sources.get(out);
        if (source === undefined || !disk.exists(join(unit, source))) {
            findings.push(unbuiltFinding(`${prefix}package.json`, one));
            continue;
        }
        const entry = { ...one, expected: expectedOf(one), source };
        const key = `${entry.what}|${String(entry.browser)}|${source}`;
        if (!entries.has(key)) {
            entries.set(key, entry);
        }
    }

    return { entries: [...entries.values()], findings };
}

const isIndexModule = (file: string): boolean => {
    const fileName = basename(file);

    return (
        SOURCE.test(fileName) &&
        fileName.split('.')[0] === 'index' &&
        ENTRY_ROOTS.has(file.split('/')[0] ?? '') &&
        !GROUND.test(file)
    );
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
    const misnamed = entries
        .filter(({ expected, source }) => !isNamedAsExpected(source, expected))
        .map((entry) => grammarFinding(`${prefix}${withoutDotSlash(entry.source)}`, entry));
    const strays = files
        .filter((file) => isIndexModule(file))
        .filter((file) => {
            const module = file.replace(TEST, '');
            return ![module, module.replace(/\.tsx$/u, '.ts')].some((one) => sources.has(one));
        })
        .map((file) => strayFinding(`${prefix}${file}`));

    return [...findings, ...misnamed, ...strays];
}
