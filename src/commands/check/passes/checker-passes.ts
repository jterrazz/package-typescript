import { existsSync } from 'node:fs';
import process from 'node:process';

import { isCommentedElsewhere } from '../../../../lint/kit/project/comments.js';
import { isFileOnDisk } from '../../../../lint/kit/project/fs-cache.js';
import { laidOutHexagonally } from '../../../../lint/kit/project/hexagonal-layout.js';
import {
    DEPENDENCY_CRUISER_CONFIGS,
    SETTINGS_FILE,
} from '../../../../lint/kit/project/jterrazz-config.js';
import { readManifest } from '../../../../lint/kit/project/manifest.js';
import { projectFiles } from '../../../../lint/kit/project/project-files.js';
import { publishes } from '../../../../lint/kit/project/project-kind.js';
import { checker } from '../../../drivers/checker/checker.js';
import { RUMDL_CONFIG } from '../../../drivers/rumdl/rumdl.js';
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
    ];

    return { log, status: checker('suppressions', args, { path: log }) };
}

// invariant: launched only where the tree holds a file whose comments it reads, so a tree of code alone prints no pass for it.
export function commentsPass(check: Check): Launched | undefined {
    if (!check.selected('comments')) {
        return undefined;
    }
    let read: boolean;
    try {
        read = projectFiles('.').some((path) => isCommentedElsewhere(path));
    } catch {
        read = true;
    }
    if (!read) {
        return undefined;
    }
    const log = check.logs.at('comments.log');
    // Stryker disable next-line StringLiteral,ArrayDeclaration: the packed command, which no mutant reaches, runs it; specs/cli/check/comments-other-languages proves both modes
    const args = ['.', ...(check.fix ? ['--fix'] : [])];

    return { log, status: checker('comments', args, { path: log }) };
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
        RUMDL_CONFIG,
        ...(check.fix ? ['--fix'] : []),
    ];

    return { log, status: checker('markdown', args, { path: log }) };
}

export function secretsPass(check: Check): Launched | undefined {
    if (check.fix || !check.selected('secrets')) {
        return undefined;
    }
    const log = check.logs.at('secrets.log');

    return { log, status: checker('secrets', ['.'], { path: log }) };
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
            ['.', '--ls-lint', check.tools.lsLint, ...mode],
            { path: log },
            { typeless: true },
        ),
    };
}

export function architecturePass(check: Check): Launched | undefined {
    // invariant: a tree laid out as a hexagonal application is held to the hexagonal map, with or without a settings file.
    if (
        !check.selected('architecture') ||
        !(
            [SETTINGS_FILE, ...DEPENDENCY_CRUISER_CONFIGS].some((name) => isFileOnDisk(name)) ||
            laidOutHexagonally(process.cwd())
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
        .filter((root) => publishes(check.declarations.get(root), readManifest(root) ?? {}))
        .map((root, index) => {
            const log = check.logs.at(`publish-${String(index)}.log`);
            const args = [root, '--publint', check.tools.publint, '--attw', check.tools.attw];

            return { log, status: checker('publish', args, { path: log }) };
        });
}
