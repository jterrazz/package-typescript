import type { Finding } from '../../engine/checker/pass.js';
import { LINT_ROOT, LINT_TREE } from './names.lint-tree.js';

type Top = keyof typeof LINT_TREE;

const LINT_FOLDERS = Object.keys(LINT_TREE);

const isTop = (name: string): name is Top => Object.hasOwn(LINT_TREE, name);

const HOLDS: Readonly<Record<Top, string>> = Object.freeze({
    consumer:
        'the declarations every consumer is held to — the catalogue, the rulebook of upstream decisions, our own rules by family, the checks',
    engine: 'what runs the declarations and knows none of them — how a project is read, the baseline, the checker, the catalogue rendered, the compiler of a rulebook into a config, the test tooling',
    self: 'the declarations only this repository is held to — its catalogue, its rules by family, its checks, the meta-tests of its corpus',
});

const FOLDER_RULES: Readonly<Record<Top, string>> = Object.freeze({
    consumer: 'names/consumer-folder-is-known',
    engine: 'names/engine-folder-is-known',
    self: 'names/self-folder-is-known',
});

const LINT_READ = 'read: docs/06-quality-checks.md#the-lint-tree';

function lintFinding(path: string, rule: string, parts: readonly string[]): Finding {
    return { message: [...parts, LINT_READ].join(' · '), path, rule };
}

function audienceFinding(prefix: string, top: Top, found: string, rest: string): Finding {
    const folders = LINT_TREE[top];

    return lintFinding(`${prefix}${LINT_ROOT}/${top}/${rest}`, FOLDER_RULES[top], [
        `found: ${found}`,
        `why: ${top}/ holds ${HOLDS[top]}, so its folders are ${folders.join(', ')}${top === 'self' ? ', beside the `index` that composes them with engine/' : ''}`,
        `fix: move ${rest === '' ? 'the file' : 'its files'} into the folder its nature names — ${folders.map((folder) => `${folder}/`).join(', ')}`,
    ]);
}

function lintTreeFinding(prefix: string, path: string, isDirectory: boolean): Finding | undefined {
    const [top = '', folder, ...deeper] = path.split('/');
    if (!isDirectory && folder === undefined) {
        return lintFinding(`${prefix}${LINT_ROOT}/${top}`, 'names/lint-root-holds-only-index', [
            `found: \`${prefix}${LINT_ROOT}/${top}\` sits at the root of lint/`,
            'why: lint/ has one tree in every repository — its root holds `index`, the entry that composes consumer/ with engine/, and a folder names the audience of every other file',
            `fix: move it into the folder its audience names — ${LINT_FOLDERS.join(', ')} — or into docs/ if it explains`,
        ]);
    }
    if (!isTop(top)) {
        return lintFinding(`${prefix}${LINT_ROOT}/${top}/`, 'names/lint-folder-is-known', [
            `found: \`${prefix}${LINT_ROOT}/${top}/\` is not a folder of the lint tree`,
            `why: lint/ has one tree in every repository, split by audience — ${LINT_FOLDERS.join(', ')}`,
            'fix: move its files where their audience puts them — a declaration every consumer is held to under consumer/, one only this repository is held to under self/, what runs them under engine/',
        ]);
    }
    if (folder === undefined || (!isDirectory && deeper.length === 0)) {
        const file = folder ?? '';

        return audienceFinding(
            prefix,
            top,
            `\`${prefix}${LINT_ROOT}/${top}/${file}\` holds a file at the root of ${top}/`,
            file,
        );
    }

    return deeper.length === 0
        ? audienceFinding(
              prefix,
              top,
              `\`${prefix}${LINT_ROOT}/${top}/${folder}/\` is not a folder of ${top}/`,
              `${folder}/`,
          )
        : undefined;
}

function skillFinding(path: string): Finding {
    return {
        message: [
            `found: \`${path}\` sits beside a skill's \`SKILL.md\``,
            'why: a skill is one `skills/<skill>/SKILL.md`, the one page an agent loads, and a file beside it is one no agent reads',
            'fix: fold what it says into the `SKILL.md` or into the chapter the skill routes to, and delete it',
            'read: docs/06-quality-checks.md#the-names-tree-pass',
        ].join(' · '),
        path,
        rule: 'names/skill-holds-only-skill-md',
    };
}

function directoryFinding(path: string): Finding {
    return {
        message: [
            `found: \`${path}\` is not written in kebab-case`,
            'why: a directory name is part of every path and import that crosses it, and one case for every name reads the same on a disk that folds case and on one that does not',
            'fix: rename it in lowercase words joined by `-` — a leading `_` marks a folder the toolchain owns, and a route segment keeps its framework grammar (`[id]`, `(group)`, `@slot`)',
            'read: docs/06-quality-checks.md#the-names-tree-pass',
        ].join(' · '),
        path,
        rule: 'names/directory-in-kebab-case',
    };
}

export type Failed = { isDirectory: boolean; path: string };

export function placementFindingOf(
    units: readonly string[],
    { isDirectory, path }: Failed,
): Finding | undefined {
    const prefix =
        units
            .filter((unit) => path.startsWith(unit))
            .toSorted((left, right) => right.length - left.length)[0] ?? '';
    const own = path.slice(prefix.length);
    if (own.startsWith(`${LINT_ROOT}/`)) {
        return lintTreeFinding(prefix, own.slice(LINT_ROOT.length + 1), isDirectory);
    }
    if (own.startsWith('skills/')) {
        return skillFinding(isDirectory ? `${path}/` : path);
    }

    return isDirectory ? directoryFinding(`${path}/`) : undefined;
}
