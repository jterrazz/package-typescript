import { basename, dirname, join } from 'node:path';

import type { Context, Finding } from '../../kit/checker/pass.js';
import {
    entrySources,
    entrySourcesOf,
    publishedOf,
    unbuiltCodeOf,
} from '../../kit/project/entry-points.js';
import type { Published } from '../../kit/project/entry-points.js';
import { GROUND_FOLDERS, TESTS_FOLDER } from '../../kit/project/ground.js';
import { parsedObject } from '../../kit/project/json.js';
import { withoutDotSlash } from '../../kit/project/packed-files.js';
import { namesFinding } from './names.lessons.js';

type Disk = Pick<Context, 'exists' | 'read'>;

type Entry = Published & { source: string };

const DEFAULT_OUT_DIR = 'dist';

const SOURCE = /\.(?:[cm]?ts|tsx)$/u;

const TEST = /\.(?:test|spec|test-d|spec-d)(?=\.[cm]?tsx?$)/u;

const ENTRY_ROOTS = new Set(['lint', 'src']);

const GROUND = new RegExp(`(?:^|/)(?:${GROUND_FOLDERS.join('|')})/`, 'u');

const stemOf = (fileName: string): string => fileName.replace(SOURCE, '');

export function buildSourcesOf(disk: Disk, unit: string): ReadonlyMap<string, string> {
    try {
        const manifest = parsedObject(disk.read(join(unit, 'package.json')) ?? '{}');

        return entrySources(manifest, (source) => disk.exists(join(unit, source)));
    } catch {
        return new Map();
    }
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

function unbuiltFinding(path: string, { stem, target, what }: Published): Finding {
    return namesFinding('names/export-has-an-entry', path, {
        fix: `write its entry, \`${stem}.ts\`, at the root of src/ or lint/, or take the subpath out of the manifest`,
        found: `${what} is published as ${target}, and no source the build compiles builds it`,
    });
}

function outsideBuildFinding(
    path: string,
    { stem, target, what }: Published,
    outDir: string,
): Finding {
    return namesFinding('names/export-has-an-entry', path, {
        fix: `build it from its entry, \`${stem}.ts\`, and publish what the build writes under \`${outDir}/\``,
        found: `${what} is published as ${target}, outside the build output \`${outDir}/\`, so no source compiles it`,
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
        fix: 'name it for what it holds, or build it as an entry: a subpath in `exports`, or a private `#` import in `imports`, built from it',
        found: `\`${path}\` is named \`index\`, and builds nothing the package publishes or imports`,
    });
}

function entriesOf(
    disk: Disk,
    unit: string,
    prefix: string,
): { entries: Entry[]; findings: Finding[] } {
    let manifest: Record<string, unknown> = {};
    try {
        manifest = parsedObject(disk.read(join(unit, 'package.json')) ?? '{}');
    } catch {
        return { entries: [], findings: [] };
    }
    const outDir = DEFAULT_OUT_DIR;
    const published = publishedOf(manifest, outDir);
    const entries = new Map<string, Entry>();
    const findings: Finding[] =
        published.length === 0
            ? []
            : unbuiltCodeOf(manifest, outDir).map((one) =>
                  outsideBuildFinding(`${prefix}package.json`, one, outDir),
              );
    for (const one of published) {
        const source = entrySourcesOf(one).find((candidate) => disk.exists(join(unit, candidate)));
        if (source === undefined) {
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

// Stryker disable next-line StringLiteral: the pattern holds no character outside ASCII, so the flag changes nothing
const TESTS_SEGMENT = new RegExp(`(^|/)${TESTS_FOLDER}/`, 'u');

const testedOf = (file: string): string => file.replace(TEST, '').replace(TESTS_SEGMENT, '$1');

const isBinModule = (file: string): boolean => stemOf(basename(testedOf(file))).endsWith('.bin');

const builds = (file: string, sources: ReadonlySet<string>): boolean => {
    const module = testedOf(file);

    return [module, module.replace(/\.tsx$/u, '.ts')].some((one) => sources.has(one));
};

export function entryGrammarOf(
    disk: Disk,
    unit: string,
    { files, prefix }: { files: readonly string[]; prefix: string },
): Finding[] {
    const { entries, findings } = entriesOf(disk, unit, prefix);
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
