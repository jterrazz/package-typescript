#!/usr/bin/env node

/**
 * The config the oxlint pass of `fix` runs with: the consumer's own, plus one
 * trailing override turning every rule marked `unsafe` in the manifest off.
 *
 * A fixer that changes MEANING cannot be applied unattended — it turns working
 * code into code that does not compile, or into code that claims something
 * else. An override is the one form that reaches a rule wherever it was armed:
 * a CLI `--allow` stops at the base config, and a rule the consumer's own
 * overrides arm again (the vitest block, on the test globs) would still
 * rewrite. Check mode keeps every one of them armed: the diagnostic is still
 * owed an answer, from a human ([Quality checks](../docs/06-quality-checks.md)).
 *
 * The file is written beside the consumer's config, never elsewhere: oxlint
 * resolves `ignorePatterns` against the directory its config sits in.
 *
 * Usage: node unsafe-fixers.js <consumer config, absolute> <wrapper to write>
 */

import { writeFileSync } from 'node:fs';
import { argv } from 'node:process';

import { unsafeFixers } from '../rules/catalog.js';

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
        "    overrides: [...(base.overrides ?? []), { files: ['**/*'], rules: OFF }],",
        '};',
        '',
    ].join('\n');
}

if (import.meta.main) {
    const [consumerConfig, wrapper] = argv.slice(2);
    writeFileSync(wrapper, wrapperOf(consumerConfig));
}
