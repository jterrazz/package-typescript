import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_ENTRY, entrySourcesOf, outputOf, publishedOf } from './entry-points.js';
import { isJsonObject, parsedObject } from './json.js';
import type { Platform, ProjectIdentity } from './project-kind.js';

export type BuildEntry = { reason: string; source: string };

export type BuildSettings = {
    dev: Readonly<Record<string, BuildEntry>>;
    entries: Readonly<Record<string, BuildEntry>>;
};

export type BuildStep = {
    clean: boolean;
    dts: boolean;
    entry: Readonly<Record<string, string>>;
    fixedExtension: false;
    format: ('cjs' | 'esm')[];
    hash: false;
    outDir: string;
    outputOptions: { chunkFileNames: string; exports?: 'named' };
    platform: 'browser' | 'node';
    sourcemap: true;
};

export const DIST = 'dist';

export const DEV_OUTPUT = '.artifacts/dev';

const BROWSER_PLATFORMS: ReadonlySet<Platform> = new Set(['astro', 'expo', 'next', 'react']);

function entriesOf(written: unknown, key: string): Record<string, BuildEntry> | string {
    if (written === undefined) {
        return {};
    }
    if (!isJsonObject(written)) {
        return `holds a \`typescript.build.${key}\` that is not an object`;
    }
    const entries: Record<string, BuildEntry> = {};
    for (const [output, entry] of Object.entries(written)) {
        const { reason, source } = isJsonObject(entry) ? entry : {};
        if (typeof source !== 'string' || typeof reason !== 'string' || reason.trim() === '') {
            return `builds \`${output}\` under \`typescript.build.${key}\` with no \`{ source, reason }\``;
        }
        entries[output] = { reason, source };
    }

    return entries;
}

export function buildSettingsOf(section: unknown): {
    problem: null | string;
    settings: BuildSettings;
} {
    const build = isJsonObject(section) ? section.build : undefined;
    const written = isJsonObject(build) ? build : {};
    const entries = entriesOf(written.entries, 'entries');
    const dev = entriesOf(written.dev, 'dev');
    const unread = { dev: {}, entries: {} };
    if (typeof entries === 'string') {
        return { problem: entries, settings: unread };
    }

    return typeof dev === 'string'
        ? { problem: dev, settings: unread }
        : { problem: null, settings: { dev, entries } };
}

type Planned = { browser: boolean; formats: Set<'cjs' | 'esm'>; source: string };

function plannedOf(root: string): Map<string, Planned> {
    const path = join(root, 'package.json');
    const manifest = existsSync(path) ? parsedObject(readFileSync(path, 'utf8')) : {};
    const planned = new Map<string, Planned>();
    for (const one of publishedOf(manifest, DIST)) {
        const source = entrySourcesOf(one).find((candidate) => existsSync(join(root, candidate)));
        const format = one.target.endsWith('.cjs')
            ? 'cjs'
            : one.target.endsWith('.js')
              ? 'esm'
              : null;
        if (source === undefined || format === null) {
            continue;
        }
        const output = outputOf(one.target, DIST);
        const known = planned.get(output) ?? { browser: one.browser, formats: new Set(), source };
        known.formats.add(format);
        planned.set(output, known);
    }

    return planned;
}

const stepOf = (
    entry: Readonly<Record<string, string>>,
    {
        clean = false,
        dts = true,
        format = ['esm'],
        outDir = DIST,
        platform,
    }: Partial<BuildStep> & Pick<BuildStep, 'platform'>,
): BuildStep => ({
    clean,
    dts,
    entry,
    fixedExtension: false,
    format,
    hash: false,
    outDir,
    outputOptions: {
        chunkFileNames: 'shared-[name].js',
        ...(format.includes('cjs') ? { exports: 'named' as const } : {}),
    },
    platform,
    sourcemap: true,
});

const sourcesBy = (entries: Readonly<Record<string, BuildEntry>>): Record<string, string> =>
    Object.fromEntries(Object.entries(entries).map(([output, { source }]) => [output, source]));

const entryRecord = (outputs: readonly [string, Planned][]): Record<string, string> =>
    Object.fromEntries(outputs.map(([output, { source }]) => [output, source]));

function publishedSteps(
    planned: readonly [string, Planned][],
    shipped: Readonly<Record<string, string>>,
    own: BuildStep['platform'],
): BuildStep[] {
    const dual = planned.filter(([, one]) => !one.browser && one.formats.has('cjs'));
    const browser = planned.filter(([, one]) => one.browser);
    const first =
        Object.keys(shipped).length > 0 ? shipped : planned.length === 0 ? DEFAULT_ENTRY : null;

    return [
        ...(first === null ? [] : [stepOf(first, { platform: own })]),
        ...(dual.length === 0
            ? []
            : [stepOf(entryRecord(dual), { format: ['esm', 'cjs'], platform: own })]),
        ...(browser.length === 0
            ? []
            : [stepOf(entryRecord(browser), { dts: false, platform: 'browser' })]),
    ];
}

export function buildPlanOf(
    root: string,
    { declaration, settings }: { declaration: null | ProjectIdentity; settings: BuildSettings },
): BuildStep[] {
    const planned = [...plannedOf(root)];
    const main = planned.filter(([, one]) => !one.browser && !one.formats.has('cjs'));
    const platform = declaration?.platform;
    const own = platform !== undefined && platform !== null && BROWSER_PLATFORMS.has(platform);
    const steps = publishedSteps(
        planned,
        { ...entryRecord(main), ...sourcesBy(settings.entries) },
        own ? 'browser' : 'node',
    );
    const [leading] = steps;
    if (leading !== undefined) {
        leading.clean = true;
    }
    const dev = sourcesBy(settings.dev);

    return Object.keys(dev).length === 0
        ? steps
        : [...steps, stepOf(dev, { clean: true, outDir: DEV_OUTPUT, platform: 'node' })];
}

export const sourcesOf = (steps: readonly BuildStep[]): Map<string, string> =>
    new Map(
        steps.filter(({ outDir }) => outDir === DIST).flatMap(({ entry }) => Object.entries(entry)),
    );
