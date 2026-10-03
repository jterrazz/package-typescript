// oxlint constraints this file is shaped by: an override is the one form that reaches a rule a
// consumer's own overrides arm again; `-c` switches nested-config discovery off, and a nested config
// replaces the root's rules in its subtree; globs resolve against the config's own directory, so a
// wrapper sits beside the config it wraps. Unused directives are not reported: this run turned rules off.
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { UNSAFE_FIXERS } from '../../lint/index.rulebook.js';
import { OXLINT_CONFIG_NAMES } from '../../lint/kit/project/oxlint-config-names.js';

type Scope = { config: string; directory: string; files: string[] };

const FIX_WRAPPER = 'oxlint.fix.config.mjs';

export function wrapperOf(consumerConfig: string): string {
    const off = Object.fromEntries(UNSAFE_FIXERS.map(({ rule }) => [rule, 'off']));
    const attributes = consumerConfig.endsWith('.json') ? " with { type: 'json' }" : '';

    return [
        `import base from ${JSON.stringify(consumerConfig)}${attributes};`,
        '',
        `const OFF = ${JSON.stringify(off)};`,
        '',
        'export default {',
        '    ...base,',
        "    options: { ...base.options, reportUnusedDisableDirectives: 'off' },",
        "    overrides: [...(base.overrides ?? []), { files: ['**/*'], rules: OFF }],",
        '};',
        '',
    ].join('\n');
}

function configIn(root: string, directory: string): null | string {
    const name = OXLINT_CONFIG_NAMES.find((candidate) =>
        existsSync(join(root, directory, candidate)),
    );
    return name === undefined ? null : join(directory, name);
}

function scopesOf(
    root: string,
    rootConfig: string,
    targets: readonly string[],
    nested: boolean,
): Scope[] {
    const rootScope: Scope = { config: rootConfig, directory: '.', files: [] };
    const scopes = new Map<string, Scope>([['.', rootScope]]);
    const closest = new Map<string, string>();

    const governing = (directory: string): string => {
        if (!nested || directory === '.' || directory === '') {
            return '.';
        }
        const known = closest.get(directory);
        if (known !== undefined) {
            return known;
        }
        const found =
            configIn(root, directory) === null ? governing(dirname(directory)) : directory;
        closest.set(directory, found);
        return found;
    };

    for (const target of targets) {
        const directory = governing(dirname(target));
        const scope = scopes.get(directory) ?? {
            config: resolve(root, configIn(root, directory) ?? ''),
            directory,
            files: [],
        };
        scopes.set(directory, scope);
        scope.files.push(target);
    }

    return [...scopes.values()].filter(
        (scope) => scope.files.length > 0 || (scope === rootScope && targets.length === 0),
    );
}

export type FixScope = { files: string[]; wrapper: string };

export function writeFixScopes({
    nested,
    root,
    rootConfig,
    targets,
}: {
    nested: boolean;
    root: string;
    rootConfig: string;
    targets: readonly string[];
}): FixScope[] {
    const written: FixScope[] = [];
    try {
        for (const scope of scopesOf(root, rootConfig, targets, nested)) {
            const wrapper = join(scope.directory, FIX_WRAPPER);
            writeFileSync(join(root, wrapper), wrapperOf(scope.config));
            written.push({ files: scope.files, wrapper });
        }
    } catch (error) {
        for (const { wrapper } of written) {
            rmSync(join(root, wrapper), { force: true });
        }
        throw error;
    }

    return written;
}
