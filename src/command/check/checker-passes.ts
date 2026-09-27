import { existsSync, readFileSync } from 'node:fs';

import { SETTINGS_FILE } from '../../../lint/engine/project/jterrazz-config.js';
import { checker } from '../checker.js';
import { isFile } from '../disk.js';
import { presetAt } from '../toolchain.js';
import type { Launched } from './launched.js';
import { isPublishable } from './project.js';
import type { Check } from './setup.js';

const DEPENDENCY_CRUISER_CONFIGS = [
    '.dependency-cruiser.cjs',
    '.dependency-cruiser.js',
    '.dependency-cruiser.mjs',
];

export async function gitignorePass(check: Check): Promise<Launched | undefined> {
    if (!check.selected('gitignore')) {
        return undefined;
    }
    const applies =
        isFile('.gitignore') ||
        (!check.fix && (await checker('gitignore', ['--has-ancestor'], 'ignore')) === 0);
    if (!applies) {
        return undefined;
    }
    const log = check.logs.at('gitignore.log');

    return { log, status: checker('gitignore', check.fix ? ['--fix'] : [], { path: log }) };
}

export function docsPass(check: Check): Launched | undefined {
    if (check.fix || !check.selected('docs') || !existsSync('.git')) {
        return undefined;
    }
    const log = check.logs.at('docs-layout.log');

    return { log, status: checker('docs', [], { path: log }) };
}

export function suppressionsPass(check: Check): Launched | undefined {
    if (!check.selected('suppressions')) {
        return undefined;
    }
    const log = check.logs.at('suppressions.log');
    const args = [
        '.',
        '--oxlint',
        check.tools.oxlint,
        ...check.configs.oxlint.args,
        ...(check.fix ? ['--fix'] : []),
        ...check.lintArgs,
    ];

    return { log, status: checker('suppressions', args, { path: log }) };
}

export function markdownPass(check: Check): Launched | undefined {
    if (!check.selected('markdown')) {
        return undefined;
    }
    const log = check.logs.at('markdown.log');
    const args = [
        '.',
        '--rumdl',
        check.tools.rumdl,
        '--rumdl-config',
        presetAt('src/presets/rumdl/rumdl.toml'),
        ...(check.fix ? ['--fix'] : []),
        ...check.lintArgs,
    ];

    return { log, status: checker('markdown', args, { path: log }) };
}

export function secretsPass(check: Check): Launched | undefined {
    if (check.fix || !check.selected('secrets')) {
        return undefined;
    }
    const log = check.logs.at('secrets.log');

    return { log, status: checker('secrets', ['.', ...check.lintArgs], { path: log }) };
}

export function namesPass(check: Check, runs: boolean): Launched | undefined {
    if (!runs) {
        return undefined;
    }
    const log = check.logs.at('names.log');
    const mode = check.fix ? ['--fix'] : ['--report', check.logs.at('names.json')];

    return {
        log,
        status: checker(
            'names',
            ['.', '--ls-lint', check.tools.lsLint, ...check.lintArgs, ...mode],
            { path: log },
            { typeless: true },
        ),
    };
}

export function commentsPass(check: Check, runs: boolean): Launched | undefined {
    if (!runs || check.fix) {
        return undefined;
    }
    const log = check.logs.at('comments.log');
    const args = ['.', ...check.lintArgs, '--report', check.logs.at('comments.json')];

    return { log, status: checker('comments', args, { path: log }) };
}

// Read as text, never run: the pass loads the settings, the command only asks whether there are any.
function declaresArchitecture(): boolean {
    return isFile(SETTINGS_FILE) && /\barchitecture\s*:/u.test(readFileSync(SETTINGS_FILE, 'utf8'));
}

export function architecturePass(check: Check): Launched | undefined {
    if (
        check.fix ||
        !check.selected('architecture') ||
        (!DEPENDENCY_CRUISER_CONFIGS.some((name) => isFile(name)) && !declaresArchitecture())
    ) {
        return undefined;
    }
    const log = check.logs.at('architecture.log');

    return {
        log,
        status: checker(
            'architecture',
            ['.', '--depcruise', check.tools.depcruise],
            { path: log },
            { typeless: true },
        ),
    };
}

export function publishPasses(check: Check): Launched[] {
    if (check.fix || !check.selected('publish')) {
        return [];
    }

    return ['.', ...check.members]
        .filter((root) => isPublishable(root))
        .map((root, index) => {
            const log = check.logs.at(`publish-${String(index)}.log`);
            const args = [
                root,
                '--publint',
                check.tools.publint,
                '--attw',
                check.tools.attw,
                '--bundle-preset',
                presetAt('dist/presets/tsdown/bundle.js'),
            ];

            return { log, status: checker('publish', args, { path: log }) };
        });
}
