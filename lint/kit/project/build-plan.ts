import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { refusal } from '../catalogue/lesson.js';
import {
    DEFAULT_ENTRY,
    DEFAULT_SOURCE,
    entrySourcesOf,
    outputOf,
    publishedOf,
} from './entry-points.js';
import { objectOf, parsedObject } from './json.js';
import type { JsonObject } from './json.js';
import { SETTINGS_FILE } from './jterrazz-config.js';
import { withoutDotSlash } from './packed-files.js';
import { presetLesson } from './preset.js';
import type { Resolution } from './preset.js';
import type { Platform, ProjectIdentity } from './project-kind.js';

export type BuildSettings = {
    dev: Readonly<Record<string, string>>;
    entries: Readonly<Record<string, string>>;
};

export type BuildStep = {
    clean: boolean;
    dts: boolean;
    entry: Readonly<Record<string, string>>;
    deps?: { neverBundle: string[] };
    fixedExtension: false;
    format: ('cjs' | 'esm')[];
    hash: false;
    outDir: string;
    outputOptions: { banner?: string; chunkFileNames: string; exports?: 'named' };
    platform: 'browser' | 'node';
    sourcemap: true;
};

export const DIST = 'dist';

export const ARTIFACTS = '.artifacts';

export const DEV_OUTPUT = `${ARTIFACTS}/dev`;

export const MUTATION_OUTPUT = `${ARTIFACTS}/stryker`;

/** The platforms whose code a bundler ships to a browser or a device: their build targets the browser. */
export const BROWSER_PLATFORMS: ReadonlySet<Platform> = new Set([
    'astro',
    'browser',
    'expo',
    'next',
    'react',
]);

const COMMAND = '.cli.ts';

// invariant: the build writes ESM as `.js` and CommonJS as `.cjs`; a `.mjs` target it does not write.
const CODE_TARGET = /\.c?js$/u;

const SELF_ROOT = 'lint/self';

const UNWALKED = /^(?:[._]|node_modules)/u;

// Stryker disable next-line ArrowFunction: APFS lists a folder in name order already, so only another file system tells the sort apart
const byName = (left: Dirent, right: Dirent): number => left.name.localeCompare(right.name);

function modulesUnder(root: string, folder: string): string[] {
    const path = join(root, folder);
    if (!existsSync(path)) {
        // Stryker disable next-line ArrayDeclaration: what a missing folder would list names no module the conventions build
        return [];
    }

    return readdirSync(path, { withFileTypes: true })
        .filter(({ name }) => !UNWALKED.test(name))
        .toSorted(byName)
        .flatMap((entry) => {
            const relative = `${folder}/${entry.name}`;

            return entry.isDirectory() ? modulesUnder(root, relative) : [relative];
        });
}

type Named = { output: string; source: string };

function namedOnce(named: readonly Named[], into: string): Record<string, string> | string {
    const entries: Record<string, string> = {};
    for (const { output, source } of named) {
        const known = entries[output];
        if (known !== undefined) {
            return `holds two modules built as \`${into}/${output}.js\`: ${known} and ${source} — rename one`;
        }
        entries[output] = source;
    }

    return entries;
}

const stemOf = (source: string): string => basename(source, '.ts');

/** The entries no manifest names, read off their names: shipped beside the published ones, or built for the repository's own scripts. */
export function conventionsOf(root: string): { problem: null | string; settings: BuildSettings } {
    // invariant: a module loaded by path is named for how it is loaded: by Node before the app, by a worker pool, by vitest as a global setup.
    const loadedByPath = /^(?:instrumentation|.+\.worker|.+\.global-setup)\.ts$/u;
    const shipped = modulesUnder(root, 'src')
        .filter((source) => loadedByPath.test(basename(source)))
        .map((source) => ({ output: stemOf(source), source }));
    const dev = [...modulesUnder(root, 'src'), ...modulesUnder(root, 'lint')]
        .filter((source) => !source.endsWith('.test.ts') && source.endsWith('.ts'))
        .flatMap((source): Named[] => {
            if (basename(source).endsWith(COMMAND)) {
                return [{ output: basename(source, COMMAND), source }];
            }

            return dirname(source) === SELF_ROOT ? [{ output: stemOf(source), source }] : [];
        });
    const entries = namedOnce(shipped, DIST);
    const devEntries = namedOnce(dev, DEV_OUTPUT);
    const unread = { dev: {}, entries: {} };
    if (typeof entries === 'string') {
        return { problem: entries, settings: unread };
    }

    return typeof devEntries === 'string'
        ? { problem: devEntries, settings: unread }
        : { problem: null, settings: { dev: devEntries, entries } };
}

type Planned = { browser: boolean; cjs: boolean; esm: boolean; source: string };

const manifestAt = (root: string): JsonObject => {
    const path = join(root, 'package.json');

    // Stryker disable next-line StringLiteral: JSON.parse reads a Buffer as its UTF-8 text, so the encoding only names the type
    return existsSync(path) ? parsedObject(readFileSync(path, 'utf8')) : {};
};

/** The code targets the manifest publishes under `dist/` whose entry, by the entry grammar, is on no disk — each said in one line. */
export function unsourcedOf(root: string): string[] {
    return publishedOf(manifestAt(root), DIST)
        .filter(({ target }) => CODE_TARGET.test(target))
        .filter((one) => !entrySourcesOf(one).some((source) => existsSync(join(root, source))))
        .map(
            (one) =>
                `${one.what} publishes ${withoutDotSlash(one.target)}, but neither ${entrySourcesOf(one).join(' nor ')} exists`,
        );
}

function plannedOf(root: string): Map<string, Planned> {
    const manifest = manifestAt(root);
    const planned = new Map<string, Planned>();
    for (const one of publishedOf(manifest, DIST)) {
        const source = entrySourcesOf(one).find((candidate) => existsSync(join(root, candidate)));
        if (source === undefined || !CODE_TARGET.test(one.target)) {
            continue;
        }
        const output = outputOf(one.target, DIST);
        const known = planned.get(output) ?? {
            browser: one.browser,
            cjs: false,
            esm: false,
            source,
        };
        const isCjs = one.target.endsWith('.cjs');
        planned.set(output, {
            ...known,
            cjs: known.cjs || isCjs,
            esm: known.esm || !isCjs,
        });
    }

    return planned;
}

const stepOf = (
    entry: Readonly<Record<string, string>>,
    {
        banner,
        clean = false,
        dts = true,
        external = [],
        format = ['esm'],
        outDir = DIST,
        platform,
    }: Partial<BuildStep> & { banner?: string; external?: string[] } & Pick<BuildStep, 'platform'>,
): BuildStep => ({
    clean,
    dts,
    entry,
    ...(external.length === 0 ? {} : { deps: { neverBundle: external } }),
    fixedExtension: false,
    format,
    hash: false,
    outDir,
    outputOptions: {
        ...(banner === undefined ? {} : { banner }),
        chunkFileNames: 'shared-[name].js',
        ...(format.includes('cjs') ? { exports: 'named' as const } : {}),
    },
    platform,
    sourcemap: true,
});

const entryRecord = (outputs: readonly [string, Planned][]): Record<string, string> =>
    Object.fromEntries(outputs.map(([output, { source }]) => [output, source]));

type Shape = { dts: boolean; external: string[] };

const HASHBANG = '#!/usr/bin/env node';

const DEPENDENCY_FIELDS = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
];

// outside: a host program (an editor, a browser) ships its API as `@types/<name>` and exists only inside the process that loads the extension; the bundler finds no package to resolve, and the build is not told to look for one.
function hostModulesOf(manifest: JsonObject): string[] {
    const declared = DEPENDENCY_FIELDS.flatMap((field) => Object.keys(objectOf(manifest[field])));
    const held = new Set(declared);

    return declared
        .filter((name) => name.startsWith('@types/'))
        .map((name) => {
            const typed = name.slice('@types/'.length);

            return typed.includes('__') ? `@${typed.replace('__', '/')}` : typed;
        })
        .filter((name) => !held.has(name))
        .toSorted();
}

// invariant: a library or a cli that is private is installed by its own repository, which reads no declaration of it: emitting them only fails on a module the host provides.
function shapeOf(root: string, declaration: null | ProjectIdentity): Shape {
    const manifest = manifestAt(root);
    const unread =
        manifest.private === true && ['cli', 'library'].includes(declaration?.kind ?? '');

    return { dts: !unread, external: hostModulesOf(manifest) };
}

const lacksHashbang = (root: string, source: string): boolean => {
    try {
        return !readFileSync(join(root, source), 'utf8').startsWith('#!');
    } catch {
        return false;
    }
};

// invariant: the command a `bin` names is run by its path, so the file opens on the interpreter line the source may omit; a source that holds one keeps it.
function nodeEntries(
    entries: Readonly<Record<string, string>>,
    root: string,
    shape: Shape,
    platform: BuildStep['platform'],
): BuildStep[] {
    const withBin = Object.entries(entries).filter(
        ([, source]) => source.endsWith('.bin.ts') && lacksHashbang(root, source),
    );
    const bins = Object.fromEntries(withBin);
    const others = Object.fromEntries(
        Object.entries(entries).filter(([output]) => !(output in bins)),
    );

    return [
        ...(Object.keys(others).length === 0 ? [] : [stepOf(others, { ...shape, platform })]),
        ...(withBin.length === 0 ? [] : [stepOf(bins, { ...shape, banner: HASHBANG, platform })]),
    ];
}

function publishedSteps(
    planned: readonly [string, Planned][],
    shipped: Readonly<Record<string, string>>,
    own: BuildStep['platform'],
    [root, shape]: [string, Shape],
): BuildStep[] {
    const dual = planned.filter(([, one]) => !one.browser && one.cjs && one.esm);
    const required = planned.filter(([, one]) => !one.browser && one.cjs && !one.esm);
    const browser = planned.filter(([, one]) => one.browser);
    const defaulted =
        planned.length === 0 &&
        (Object.keys(shipped).length === 0 || existsSync(join(root, DEFAULT_SOURCE)));
    const entries = { ...(defaulted ? DEFAULT_ENTRY : {}), ...shipped };

    return [
        ...nodeEntries(entries, root, shape, own),
        ...(dual.length === 0
            ? []
            : [stepOf(entryRecord(dual), { ...shape, format: ['esm', 'cjs'], platform: own })]),
        ...(required.length === 0
            ? []
            : [stepOf(entryRecord(required), { ...shape, format: ['cjs'], platform: own })]),
        ...(browser.length === 0
            ? []
            : [
                  stepOf(entryRecord(browser), {
                      dts: false,
                      external: shape.external,
                      platform: 'browser',
                  }),
              ]),
    ];
}

export function buildPlanOf(
    root: string,
    { declaration, settings }: { declaration: null | ProjectIdentity; settings: BuildSettings },
): BuildStep[] {
    const planned = [...plannedOf(root)];
    const main = planned.filter(([, one]) => !one.browser && !one.cjs);
    const platform = declaration?.platform;
    const shape = shapeOf(root, declaration);
    const own = [...BROWSER_PLATFORMS].some((one) => one === platform);
    // invariant: a mobile app is bundled by its framework — Metro, through `expo export` — and publishes nothing a package build compiles: its `main` names the router's entry, never a module of dist/.
    const steps =
        declaration?.kind === 'mobile'
            ? []
            : publishedSteps(
                  planned,
                  { ...entryRecord(main), ...settings.entries },
                  own ? 'browser' : 'node',
                  [root, shape],
              );
    const [leading] = steps;
    if (leading !== undefined) {
        leading.clean = true;
    }
    const { dev } = settings;

    return Object.keys(dev).length === 0
        ? steps
        : [
              ...steps,
              stepOf(dev, {
                  clean: true,
                  external: shape.external,
                  outDir: DEV_OUTPUT,
                  platform: 'node',
              }),
          ];
}

/** The build a project's manifest, its tree and its declaration derive, or the refusal of a declaration that does not read; a setting the build does not read is the check's to refuse. */
export function planOf(root: string, { problem, resolved }: Resolution): BuildStep[] | string {
    const derived = conventionsOf(root);
    const refused = (resolved.declaration === null ? problem : null) ?? derived.problem;
    if (refused !== null) {
        return refusal({
            ...presetLesson(refused, SETTINGS_FILE),
            read: 'docs/reference/building.md#the-entries',
        });
    }
    const unsourced = unsourcedOf(root);

    return unsourced.length === 0
        ? buildPlanOf(root, { declaration: resolved.declaration, settings: derived.settings })
        : refusal({
              fix: 'name each entry by the entry grammar — `./register` is built from src/index.register.ts — or drop the target from package.json',
              found: unsourced.join('; '),
              read: 'docs/reference/building.md#the-entries',
              why: 'a build that skips a published target ships a package whose import of it resolves to nothing',
          });
}
