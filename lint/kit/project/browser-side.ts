import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { MUTATION_OUTPUT } from './build-plan.js';
import { isJsonObject, objectOf } from './json.js';
import { projectFiles, readText } from './project-files.js';

// outside: a component, an island or a template runs in the browser, where the mutation run starts no project: no test of it is credited with a mutant there.
const BROWSER_SIDE = /\.(?:astro|jsx|svelte|tsx|vue)$/u;

/** Whether a source runs in the browser, where a mutation run credits no test with a mutant. */
export const isBrowserSide = (file: string): boolean => BROWSER_SIDE.test(file);

/** The mutants of browser-side sources that no test ran, in the last module report of the unit; `null` when the unit holds none (no run yet, or one that wrote none). */
export function unmeasuredBrowserMutants(unit: string): null | number {
    try {
        // Stryker disable next-line StringLiteral: a buffer parses as its text, so the encoding changes nothing the parse could show
        const text = readFileSync(join(unit, MUTATION_OUTPUT, 'report.json'), 'utf8');
        const report: unknown = JSON.parse(text);
        let count = 0;
        for (const [file, entry] of Object.entries(objectOf(objectOf(report).files))) {
            const { mutants } = objectOf(entry);
            if (isBrowserSide(file) && Array.isArray(mutants)) {
                count += mutants.filter(
                    (mutant) => isJsonObject(mutant) && mutant.status === 'NoCoverage',
                ).length;
            }
        }

        return count;
    } catch {
        return null;
    }
}

const CLIENT_ONLY_EXTENSIONS = ['.tsx', '.jsx', '.vue', '.svelte'];

const IMPORT = /import\s+(?<name>\w+)\s+from\s+['"](?<from>\.[^'"]*)['"]/gu;

const CLIENT_ONLY_TAG = /<(?<name>\w+)\b[^>]*\bclient:only\b/gu;

function holdsFile(unit: string, path: string): boolean {
    // Stryker disable BlockStatement: find reads an undefined and a false the same
    try {
        return statSync(join(unit, path)).isFile();
    } catch {
        return false;
    }
    // Stryker restore BlockStatement
}

function resolvedImport(unit: string, from: string): string | undefined {
    const bare = posix.normalize(from);

    return [bare, ...CLIENT_ONLY_EXTENSIONS.map((extension) => `${bare}${extension}`)].find((one) =>
        holdsFile(unit, one),
    );
}

/** The sources an Astro page loads with `client:only`: the server imports their module and renders none of it, so a mutant there is run by no test the run can credit. */
export function clientOnlySources(unit: string): ReadonlySet<string> {
    const sources = new Set<string>();
    for (const page of projectFiles(unit).filter((file) => file.endsWith('.astro'))) {
        const text = readText(unit, page);
        if (text === null) {
            continue;
        }
        const imported = new Map(
            // Stryker disable OptionalChaining,StringLiteral: a match of a pattern holding named groups always carries its groups
            [...text.matchAll(IMPORT)].map((match) => [
                match.groups?.name ?? '',
                match.groups?.from ?? '',
            ]),
            // Stryker restore OptionalChaining,StringLiteral
        );
        for (const tag of text.matchAll(CLIENT_ONLY_TAG)) {
            // Stryker disable next-line OptionalChaining,StringLiteral: a match of a pattern holding named groups always carries its groups
            const from = imported.get(tag.groups?.name ?? '');
            const found =
                from === undefined
                    ? undefined
                    : resolvedImport(unit, posix.join(posix.dirname(page), from));
            if (found !== undefined) {
                sources.add(found);
            }
        }
    }

    return sources;
}

const unmeasured = (mutant: unknown): unknown =>
    isJsonObject(mutant) && mutant.status === 'Survived'
        ? { ...mutant, status: 'NoCoverage' }
        : mutant;

function entryUnmeasured(entry: unknown): unknown {
    const { mutants } = objectOf(entry);

    return Array.isArray(mutants)
        ? { ...objectOf(entry), mutants: mutants.map((mutant) => unmeasured(mutant)) }
        : entry;
}

/** A report where every mutant of a source in `sources` that no test judged (one that survived, or none ran) reads as one no test ran, so the verdict counts it unmeasured instead of failing on a line no test could judge. */
export function reportWithUnmeasured(report: unknown, sources: ReadonlySet<string>): unknown {
    if (sources.size === 0) {
        return report;
    }
    const files = Object.entries(objectOf(objectOf(report).files)).map(
        ([file, entry]): [string, unknown] => [
            file,
            sources.has(file) ? entryUnmeasured(entry) : entry,
        ],
    );

    return { ...objectOf(report), files: Object.fromEntries(files) };
}
