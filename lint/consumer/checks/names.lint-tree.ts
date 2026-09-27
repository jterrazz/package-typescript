import { catalogueFamilies } from '../../engine/catalogue/families.js';
import type { Finding } from '../../engine/checker/pass.js';
import { exportedFunctions, exportedValues } from '../../engine/project/exported-names.js';
import { GROUND_FOLDERS } from '../../engine/project/ground.js';
import { EVERY_NAME, importersOf } from '../../engine/project/importers.js';
import { readText } from '../../engine/project/project-files.js';

type Top = keyof typeof LINT_TREE;

type Exported = { functions: string[]; values: string[] };

type Candidate = Exported & { file: string };

export const LINT_ROOT = 'lint';

export const LINT_TREE: {
    readonly consumer: readonly string[];
    readonly engine: readonly string[];
    readonly self: readonly string[];
} = Object.freeze({
    consumer: Object.freeze(['catalogue', 'rulebook', 'rules', 'checks']),
    engine: Object.freeze(['project', 'baseline', 'checker', 'catalogue', 'compiler', 'testing']),
    self: Object.freeze(['catalogue', 'rules', 'checks', 'corpus']),
});

const AUDIENCES: ReadonlySet<string> = new Set(['consumer', 'self']);

const isTop = (name: string): name is Top => Object.hasOwn(LINT_TREE, name);

const READ = 'read: docs/06-quality-checks.md#the-lint-tree';

const MODULE = /\.(?:[cm]?[jt]sx?)$/u;

const PROGRAM =
    /\bimport\.meta\.main\b|\bprocess\.(?:argv|exit)\b|\bimport\s*\{[^}]*\b(?:argv|exit)\b[^}]*\}\s*from\s*['"](?:node:)?process['"]/u;

const TEST_MATERIAL = new RegExp(
    `\\.test(?:-d)?\\.[cm]?[jt]sx?$|(?:^|/)(?:${GROUND_FOLDERS.join('|')})/`,
    'u',
);

const stemOf = (name: string): string => name.split('.')[0] ?? '';

const isIndex = (name: string): boolean => stemOf(name) === 'index';

function helperFinding(path: string, names: readonly string[]): Finding {
    const listed = names.map((name) => `\`${name}\``).join(', ');

    return {
        message: [
            `found: \`${path}\` hands ${listed} to another module, named for no declaration of its file`,
            'why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and what a declaration hands another module carries its file’s name, a value as a function, but for a catalogue row or what an `index` composes; one named for something else is code or data other files share, and that is the engine’s',
            `fix: move ${names.length === 1 ? 'it' : 'them'} under engine/ — ${LINT_TREE.engine.map((folder) => `${folder}/`).join(', ')} — or, when it is this declaration’s own, name it for the file`,
            READ,
        ].join(' · '),
        path,
        rule: 'names/audience-holds-only-declarations',
    };
}

function programFinding(path: string): Finding {
    return {
        message: [
            `found: \`${path}\` is a program — it reads the command line, ends the process or runs when executed`,
            'why: consumer/ and self/ hold declarations alone, and the checker is what reads a command line, runs the declarations and says how the run ended; a program filed as a declaration is engine code no lock sees',
            'fix: move the program under engine/checker/ and hand it this declaration from an `index`, leaving here only what it judges',
            READ,
        ].join(' · '),
        path,
        rule: 'names/audience-holds-only-declarations',
    };
}

function ruleFamilyFinding(path: string, place: string, family: string): Finding {
    return {
        message: [
            `found: \`${path}\` sits ${place}, and its catalogue row gives it the family \`${family}\``,
            'why: a rule file sits under the folder of its family, so the tree and the catalogue say one thing',
            `fix: move it to \`rules/${family}/\`, or correct the family its catalogue row declares`,
            READ,
        ].join(' · '),
        path,
        rule: 'names/rule-file-in-its-family-folder',
    };
}

function misfiledRule(
    file: string,
    rest: readonly string[],
    families: ReadonlyMap<string, string>,
    prefix: string,
): Finding[] {
    const fileName = rest.at(-1) ?? '';
    const stem = stemOf(fileName);
    const family = families.get(stem);
    if (family === undefined || stem === 'plugin') {
        return [];
    }
    const filed = rest.length > 1 ? rest[0] : undefined;
    if (filed === family) {
        return [];
    }

    return [
        ruleFamilyFinding(
            `${prefix}${file}`,
            filed === undefined ? 'at the root of `rules/`' : `under \`rules/${filed}/\``,
            family,
        ),
    ];
}

const isJudged = (file: string, fileName: string): boolean =>
    MODULE.test(fileName) && !TEST_MATERIAL.test(file);

const bare = (name: string): string => name.replaceAll(/[-_]/gu, '').toLowerCase();

function isNamedFor(name: string, fileName: string): boolean {
    return fileName
        .replace(MODULE, '')
        .split('.')
        .some((part) => bare(name).includes(bare(part)));
}

function declarationOf(
    unit: string,
    file: string,
    fileName: string,
    folder: string,
): Exported & { findings: ((path: string) => Finding)[] } {
    if (!isJudged(file, fileName)) {
        return { findings: [], functions: [], values: [] };
    }
    const text = readText(unit, file) ?? '';
    const foreign = (names: readonly string[]): string[] =>
        names.filter((name) => !isNamedFor(name, fileName));

    return {
        findings: PROGRAM.test(text) ? [programFinding] : [],
        functions: foreign(exportedFunctions(text)),
        values: folder === 'catalogue' ? [] : foreign(exportedValues(text)),
    };
}

const isOwnReader = (file: string, reader: string): boolean => {
    const folder = file.slice(0, file.lastIndexOf('/') + 1);

    return (
        reader.startsWith(folder) &&
        !reader.slice(folder.length).includes('/') &&
        stemOf(reader.slice(folder.length)) === stemOf(file.slice(folder.length))
    );
};

const isComposer = (reader: string): boolean =>
    reader.startsWith(`${LINT_ROOT}/`) && isIndex(reader.slice(reader.lastIndexOf('/') + 1));

function handedTo(
    file: string,
    readers: ReadonlyMap<string, ReadonlySet<string>>,
    { functions, values }: Exported,
): string[] {
    const handed = new Set<string>();
    for (const [reader, imported] of readers) {
        if (isOwnReader(file, reader)) {
            continue;
        }
        const judged = isComposer(reader) ? functions : [...functions, ...values];
        for (const name of judged.filter((one) => imported.has(one) || imported.has(EVERY_NAME))) {
            handed.add(name);
        }
    }

    return [...functions, ...values].filter((name) => handed.has(name));
}

function sharedHelpers(
    unit: string,
    files: readonly string[],
    candidates: readonly Candidate[],
): { file: string; names: string[] }[] {
    if (candidates.length === 0) {
        return [];
    }
    const importers = importersOf(unit, files);

    return candidates
        .map(({ file, ...exported }) => ({
            file,
            names: handedTo(file, importers.get(file) ?? new Map<string, Set<string>>(), exported),
        }))
        .filter(({ names }) => names.length > 0);
}

function isDeclaration(
    top: string,
    folder: string | undefined,
    rest: readonly string[],
): folder is string {
    return (
        AUDIENCES.has(top) &&
        folder !== undefined &&
        rest.length > 0 &&
        isTop(top) &&
        LINT_TREE[top].includes(folder)
    );
}

function judgedDeclaration({
    families,
    file,
    folder,
    prefix,
    rest,
    unit,
}: {
    families: ReadonlyMap<string, string>;
    file: string;
    folder: string;
    prefix: string;
    rest: readonly string[];
    unit: string;
}): { candidates: Candidate[]; findings: Finding[] } {
    const misfiled = folder === 'rules' ? misfiledRule(file, rest, families, prefix) : [];
    const {
        findings: made,
        functions,
        values,
    } = declarationOf(unit, file, rest.at(-1) ?? '', folder);

    return {
        candidates: functions.length + values.length > 0 ? [{ file, functions, values }] : [],
        findings: [...misfiled, ...made.map((finding) => finding(`${prefix}${file}`))],
    };
}

export function lintTreeOf(files: readonly string[], unit: string, prefix: string): Finding[] {
    const lintFiles = files.filter((file) => file.startsWith(`${LINT_ROOT}/`));
    const families = catalogueFamilies(unit, lintFiles);
    const findings: Finding[] = [];
    const candidates: Candidate[] = [];

    for (const file of lintFiles) {
        const [, top = '', folder, ...rest] = file.split('/');
        if (isDeclaration(top, folder, rest)) {
            const judged = judgedDeclaration({ families, file, folder, prefix, rest, unit });
            findings.push(...judged.findings);
            candidates.push(...judged.candidates);
        }
    }
    for (const { file, names } of sharedHelpers(unit, files, candidates)) {
        findings.push(helperFinding(`${prefix}${file}`, names));
    }

    return findings;
}
