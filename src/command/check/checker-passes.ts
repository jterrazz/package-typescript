import { existsSync } from 'node:fs';

import {
    DEPENDENCY_CRUISER_CONFIGS,
    SETTINGS_FILE,
} from '../../../lint/kit/project/jterrazz-config.js';
import { publishes } from '../../../lint/kit/project/project-kind.js';
import { checker } from '../checker.js';
import { isDirectoryOnDisk, isFileOnDisk } from '../disk.js';
import { presetAt } from '../toolchain.js';
import type { Launched } from './launched.js';
import type { Check } from './setup.js';

export async function gitignorePass(check: Check): Promise<Launched | undefined> {
    if (!check.selected('gitignore')) {
        return undefined;
    }
    const applies =
        isFileOnDisk('.gitignore') ||
        (!check.fix && (await checker('gitignore', ['--has-ancestor'], 'ignore')) === 0);
    if (!applies) {
        return undefined;
    }
    const log = check.logs.at('gitignore.log');

    return { log, status: checker('gitignore', check.fix ? ['--fix'] : [], { path: log }) };
}

export function configPass(check: Check): Launched | undefined {
    if (!check.selected('config')) {
        return undefined;
    }
    const log = check.logs.at('config.log');

    return {
        log,
        status: checker('config', ['.', ...(check.fix ? ['--fix'] : [])], { path: log }),
    };
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

export function namesPass(check: Check): Launched | undefined {
    if (!check.selected('names')) {
        return undefined;
    }
    const log = check.logs.at('names.log');
    const mode = check.fix ? ['--fix'] : [];

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

export function commentsPass(check: Check): Launched | undefined {
    if (!check.selected('comments') || check.fix) {
        return undefined;
    }
    const log = check.logs.at('comments.log');
    const args = ['.', ...check.lintArgs];

    return { log, status: checker('comments', args, { path: log }) };
}

export function architecturePass(check: Check): Launched | undefined {
    // The base preset's laws hold a `lint/` tree wherever one stands, with or without a settings file.
    if (
        !check.selected('architecture') ||
        !(
            [SETTINGS_FILE, ...DEPENDENCY_CRUISER_CONFIGS].some((name) => isFileOnDisk(name)) ||
            isDirectoryOnDisk('lint')
        )
    ) {
        return undefined;
    }
    const log = check.logs.at('architecture.log');

    return {
        log,
        status: checker(
            'architecture',
            ['.', '--depcruise', check.tools.depcruise, ...(check.fix ? ['--fix'] : [])],
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
        .filter((root) => publishes(check.declarations.get(root)))
        .map((root, index) => {
            const log = check.logs.at(`publish-${String(index)}.log`);
            const args = [root, '--publint', check.tools.publint, '--attw', check.tools.attw];

            return { log, status: checker('publish', args, { path: log }) };
        });
}
