#!/usr/bin/env node

/**
 * The configs the oxlint pass of `fix` runs with: one per config SCOPE — the
 * consumer's own, and each nested `oxlint.config.*` beneath it — each plus
 * one trailing override turning every rule marked `unsafe` in the manifest off.
 *
 * A fixer that changes MEANING cannot be applied unattended — it turns working
 * code into code that does not compile, or into code that claims something
 * else. Plain `oxlint --fix` applies every one of them: each rule the manifest
 * marks has a fix kind `--fix` runs, and the rule-surface suite holds that. An
 * override is the one form that reaches a rule wherever it was armed: a CLI
 * `--allow` stops at the base config, and a rule the consumer's own overrides
 * arm again (the vitest block, on the test globs) would still rewrite. Check
 * mode keeps every one of them armed: the diagnostic is still owed an answer,
 * from a human ([Quality checks](../../docs/06-quality-checks.md)).
 *
 * A config handed with `-c` switches oxlint's nested-config discovery off, and
 * a nested config REPLACES the root's rules in its subtree rather than
 * extending them. So each scope gets its own run: the files whose closest
 * config is that one, under a wrapper of that config — which is what `check`,
 * discovering them itself, lints each file by. A project on the default config
 * has one scope: `check` hands the default with `-c` too.
 *
 * Each wrapper is written beside the config it wraps, never elsewhere: oxlint
 * resolves `ignorePatterns` and override globs against the directory its config
 * sits in. The run it configures ignores it, so no diagnostic ever names a file
 * the pass itself wrote and deleted.
 *
 * It also stops the run REPORTING UNUSED DIRECTIVES. Every profile ships
 * `reportUnusedDisableDirectives`, and a run that has just turned twelve rules
 * off cannot judge a directive naming one of them: the rule is off for this
 * run alone, and the directive would be called dead on evidence only the
 * wrapper created. The check-shaped run made after the fixer — the same rules
 * the consumer armed — is where an unused directive is reported.
 *
 * Usage: node unsafe-fixers.js <config, absolute> <nested|flat> <scratch dir> < targets
 * Prints one line per scope, `<wrapper>\t<file listing its targets>`. An empty
 * target list — a sweep that could not answer — is one root scope with an
 * empty listing, so the run lints the directory as `check` does.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argv, cwd, stdin, stdout } from 'node:process';

import { unsafeFixers } from '../../lint/catalog.js';

/** The name every wrapper takes, beside the config it wraps. */
const WRAPPER = 'oxlint.fix.config.mjs';

/** The config names oxlint looks for, in its order — the list tool-configs.sh reads. */
const CONFIG_NAMES = JSON.parse(
    readFileSync(new URL('oxlint-config-names.json', import.meta.url), 'utf8'),
);

/** The wrapper module's source, for a JSON or an ES module config. */
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

/** The config oxlint would find in one directory, or null. */
function configIn(root, directory) {
    const name = CONFIG_NAMES.find((candidate) => existsSync(join(root, directory, candidate)));
    return name === undefined ? null : join(directory, name);
}

/**
 * The targets grouped by the config that governs each — the closest nested
 * config beneath the root, else the root's — root scope first.
 *
 * @param {string} root The project root, the directory every target is relative to.
 * @param {string} rootConfig The config the root scope runs by, absolute.
 * @param {string[]} targets The files the pass lints, relative to the root.
 * @param {boolean} nested Whether nested configs govern their subtrees.
 * @returns {{ config: string, directory: string, files: string[] }[]} One entry per scope.
 */
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
