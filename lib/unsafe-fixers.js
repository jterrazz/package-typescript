#!/usr/bin/env node

/**
 * The rules `fix` must not let oxlint rewrite, as the flags that switch them
 * off for one run: `--allow <rule>` per rule, one per line.
 *
 * A fixer that changes MEANING cannot be applied unattended — it turns working
 * code into code that does not compile, or into code that claims something
 * else. The rules are marked in the manifest (`unsafeFix()`), this prints them
 * for the shell, and the oxlint pass of `fix` passes them through. Check mode
 * keeps every one of them armed: the diagnostic is still owed an answer, from
 * a human ([Quality checks](../docs/06-quality-checks.md)).
 *
 * Usage: node unsafe-fixers.js
 */

import { stdout } from 'node:process';

import { unsafeFixers } from '../rules/catalog.js';

if (import.meta.main) {
    for (const { rule } of unsafeFixers()) {
        stdout.write(`--allow\n${rule}\n`);
    }
}
