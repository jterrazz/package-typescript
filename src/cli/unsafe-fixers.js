#!/usr/bin/env node

// oxlint constraints this file is shaped by: an override is the one form that reaches a rule a
// consumer's own overrides arm again; `-c` switches nested-config discovery off, and a nested config
// replaces the root's rules in its subtree; globs resolve against the config's own directory, so a
// wrapper sits beside the config it wraps. Unused directives are not reported: this run turned rules off.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argv, cwd, stdin, stdout } from 'node:process';

import { unsafeFixers } from '../../lint/rulebook/decisions.js';

const WRAPPER = 'oxlint.fix.config.mjs';

// The list tool-configs.sh reads, in oxlint's lookup order.
const CONFIG_NAMES = JSON.parse(
    readFileSync(new URL('../../lint/reading/oxlint-config-names.json', import.meta.url), 'utf8'),
);

export function wrapperOf(consumerConfig) {
    const off = Object.fromEntries(unsafeFixers().map(({ rule }) => [rule, 'off']));
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

function configIn(root, directory) {
    const name = CONFIG_NAMES.find((candidate) => existsSync(join(root, directory, candidate)));
    return name === undefined ? null : join(directory, name);
}

/** @returns {{ config: string, directory: string, files: string[] }[]} one entry per config scope */
function scopesOf(root, rootConfig, targets, nested) {
    const rootScope = { config: rootConfig, directory: '.', files: [] };
    const scopes = new Map([['.', rootScope]]);
    const closest = new Map();

    const governing = (directory) => {
        if (!nested || directory === '.' || directory === '') {
            return '.';
        }
        if (!closest.has(directory)) {
            closest.set(
                directory,
                configIn(root, directory) === null ? governing(dirname(directory)) : directory,
            );
        }
        return closest.get(directory);
    };

    for (const target of targets) {
        const directory = governing(dirname(target));
        if (!scopes.has(directory)) {
            const config = resolve(root, configIn(root, directory));
            scopes.set(directory, { config, directory, files: [] });
        }
        scopes.get(directory).files.push(target);
    }

    return [...scopes.values()].filter(
        (scope) => scope.files.length > 0 || (scope === rootScope && targets.length === 0),
    );
}

if (import.meta.main) {
    const [rootConfig, mode, scratch] = argv.slice(2);
    const root = cwd();
    const targets = readFileSync(stdin.fd, 'utf8')
        .split('\n')
        .filter((line) => line !== '');

    const lines = scopesOf(root, rootConfig, targets, mode === 'nested').map((scope, index) => {
        const wrapper = join(scope.directory, WRAPPER);
        const listing = join(scratch, `fix-scope-${index}.txt`);
        writeFileSync(wrapper, wrapperOf(scope.config));
        writeFileSync(listing, scope.files.map((file) => `${file}\n`).join(''));
        return `${wrapper}\t${listing}\n`;
    });
    stdout.write(lines.join(''));
}
