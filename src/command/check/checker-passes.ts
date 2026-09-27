import { existsSync } from 'node:fs';

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

function checkOnly(check: Check, pass: 'markdown' | 'secrets'): Launched | undefined {
    if (check.fix || !check.selected(pass)) {
        return undefined;
    }
    const log = check.logs.at(`${pass}.log`);

    return { log, status: checker(pass, ['.', ...check.lintArgs], { path: log }) };
}

export function markdownPass(check: Check): Launched | undefined {
    return checkOnly(check, 'markdown');
}

export function secretsPass(check: Check): Launched | undefined {
    return checkOnly(check, 'secrets');
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
            ['.', ...check.lintArgs, ...mode],
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

export function architecturePass(check: Check): Launched | undefined {
    if (
        check.fix ||
        !check.selected('architecture') ||
        !DEPENDENCY_CRUISER_CONFIGS.some((name) => isFile(name))
    ) {
        return undefined;
    }
    const log = check.logs.at('architecture.log');

    return {
        log,
        status: checker('architecture', ['.', '--depcruise', check.tools.depcruise], { path: log }),
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
