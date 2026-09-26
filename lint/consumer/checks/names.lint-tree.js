import { catalogueFamilies } from '../../engine/catalogue/families.js';
import { exportedFunctions } from '../../engine/project/exported-functions.js';
import { EVERY_NAME, importersOf } from '../../engine/project/importers.js';
import { readText } from '../../engine/project/project-files.js';

export const LINT_ROOT = 'lint';

const TREE = Object.freeze({
    consumer: Object.freeze(['catalogue', 'rulebook', 'rules', 'checks']),
    engine: Object.freeze(['project', 'baseline', 'checker', 'catalogue', 'compiler', 'testing']),
    self: Object.freeze(['catalogue', 'rules', 'checks', 'corpus']),
});

const AUDIENCES = new Set(['consumer', 'self']);

const FOLDER_RULES = Object.freeze({
    consumer: 'names/consumer-folder-is-known',
    engine: 'names/engine-folder-is-known',
    self: 'names/self-folder-is-known',
});

const LINT_FOLDERS = Object.keys(TREE);

const READ = 'read: docs/06-quality-checks.md#the-lint-tree';

const MODULE = /\.(?:[cm]?[jt]sx?)$/u;

const TEST_MATERIAL = /\.test(?:-d)?\.[cm]?[jt]sx?$|(?:^|\/)(?:expected|fixtures)\//u;

const stemOf = (name) => name.split('.')[0] ?? '';

const isIndex = (name) => stemOf(name) === 'index';

const bySorted = (left, right) => (left < right ? -1 : 1);

const HOLDS = Object.freeze({
    consumer:
        'the declarations every consumer is held to — the catalogue, the rulebook of upstream decisions, our own rules by family, the checks',
    engine: 'what runs the declarations and knows none of them — how a project is read, the baseline, the checker, the catalogue rendered, the compiler of a rulebook into a config, the test tooling',
    self: 'the declarations only this repository is held to — its catalogue, its rules by family, its checks, the meta-tests of its corpus',
});

function lintRootFinding(path) {
    return {
        message: [
            `found: \`${path}\` sits at the root of lint/`,
            'why: lint/ has one tree in every repository — its root holds `index`, the entry that composes consumer/ with engine/, and a folder names the audience of every other file',
            `fix: move it into the folder its audience names — ${LINT_FOLDERS.join(', ')} — or into docs/ if it explains`,
            READ,
        ].join(' · '),
        path,
        rule: 'names/lint-root-holds-only-index',
    };
}

function lintFolderFinding(path) {
    return {
        message: [
            `found: \`${path}\` is not a folder of the lint tree`,
            `why: lint/ has one tree in every repository, split by audience — ${LINT_FOLDERS.join(', ')}`,
            'fix: move its files where their audience puts them — a declaration every consumer is held to under consumer/, one only this repository is held to under self/, what runs them under engine/',
            READ,
        ].join(' · '),
        path,
        rule: 'names/lint-folder-is-known',
    };
}

function audienceFolderFinding(path, audience, isFile) {
    const folders = TREE[audience];
    const found = isFile
        ? `found: \`${path}\` sits at the root of ${audience}/`
        : `found: \`${path}\` is not a folder of ${audience}/`;

    return {
        message: [
            found,
            `why: ${audience}/ holds ${HOLDS[audience]}, so its folders are ${folders.join(', ')}${audience === 'self' ? ', beside the `index` that composes them with engine/' : ''}`,
            `fix: move ${isFile ? 'it' : 'its files'} into the folder its nature names — ${folders.map((folder) => `${folder}/`).join(', ')}`,
            READ,
        ].join(' · '),
        path,
        rule: FOLDER_RULES[audience],
    };
}

function helperFinding(path, names) {
    const listed = names.map((name) => `\`${name}\``).join(', ');

    return {
        message: [
            `found: \`${path}\` hands ${listed} to another module, named for no declaration of its file`,
            'why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and a function a declaration exports carries its file’s name; one named for something else is code other files call, and that code is the engine’s',
            `fix: move ${names.length === 1 ? 'it' : 'them'} under engine/ — ${TREE.engine.map((folder) => `${folder}/`).join(', ')} — or, when it is this declaration’s own, name it for the file`,
            READ,
        ].join(' · '),
        path,
        rule: 'names/audience-holds-only-declarations',
    };
}

function ruleFamilyFinding(path, place, family) {
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

function misfiledRule(file, rest, families, prefix) {
    const fileName = rest.at(-1);
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

function foreignFunctions(unit, file, fileName) {
    if (!MODULE.test(fileName) || TEST_MATERIAL.test(file)) {
        return [];
    }
    const own = stemOf(fileName).replaceAll('-', '').toLowerCase();

    return exportedFunctions(readText(unit, file) ?? '').filter(
        (name) => !name.toLowerCase().includes(own),
    );
}

const isOwnReader = (file, reader) => {
    const folder = file.slice(0, file.lastIndexOf('/') + 1);

    return (
        reader.startsWith(folder) &&
        !reader.slice(folder.length).includes('/') &&
        stemOf(reader.slice(folder.length)) === stemOf(file.slice(folder.length))
    );
};

function handedTo(file, readers, names) {
    const handed = new Set();
    for (const [reader, imported] of readers) {
        if (isOwnReader(file, reader)) {
            continue;
        }
        for (const name of names.filter((one) => imported.has(one) || imported.has(EVERY_NAME))) {
            handed.add(name);
        }
    }

    return names.filter((name) => handed.has(name));
}

function sharedHelpers(unit, files, candidates) {
    if (candidates.length === 0) {
        return [];
    }
    const importers = importersOf(unit, files);

    return candidates
        .map(({ file, names }) => ({
            file,
            names: handedTo(file, importers.get(file) ?? new Map(), names),
        }))
        .filter(({ names }) => names.length > 0);
}

function placementOf(top, folder, rest) {
    if (folder === undefined) {
        return isIndex(top) ? 'placed' : 'lint-root';
    }
    if (!LINT_FOLDERS.includes(top)) {
        return 'foreign-top';
    }
    if (rest.length === 0) {
        return top === 'self' && isIndex(folder) ? 'placed' : 'audience-root';
    }
    if (!TREE[top].includes(folder)) {
        return 'foreign-folder';
    }

    return AUDIENCES.has(top) ? 'declaration' : 'placed';
}

export function lintTreeOf(files, unit, prefix) {
    const lintFiles = files.filter((file) => file.startsWith(`${LINT_ROOT}/`));
    const families = catalogueFamilies(unit, lintFiles);
    const findings = [];
    const foreign = new Set();
    const foreignInAudience = new Map();
    const candidates = [];

    for (const file of lintFiles) {
        const [, top, folder, ...rest] = file.split('/');
        const placement = placementOf(top, folder, rest);
        if (placement === 'lint-root') {
            findings.push(lintRootFinding(`${prefix}${file}`));
        } else if (placement === 'audience-root') {
            findings.push(audienceFolderFinding(`${prefix}${file}`, top, true));
        } else if (placement === 'foreign-top') {
            foreign.add(top);
        } else if (placement === 'foreign-folder') {
            foreignInAudience.set(`${top}/${folder}`, top);
        } else if (placement === 'declaration') {
            if (folder === 'rules') {
                findings.push(...misfiledRule(file, rest, families, prefix));
            }
            const names = foreignFunctions(unit, file, rest.at(-1));
            if (names.length > 0) {
                candidates.push({ file, names });
            }
        }
    }
    for (const { file, names } of sharedHelpers(unit, files, candidates)) {
        findings.push(helperFinding(`${prefix}${file}`, names));
    }

    return [
        ...findings,
        ...[...foreign]
            .toSorted(bySorted)
            .map((top) => lintFolderFinding(`${prefix}${LINT_ROOT}/${top}/`)),
        ...[...foreignInAudience]
            .toSorted(([left], [right]) => bySorted(left, right))
            .map(([path, audience]) =>
                audienceFolderFinding(`${prefix}${LINT_ROOT}/${path}/`, audience, false),
            ),
    ];
}
