#!/usr/bin/env node

/**
 * No file the project would commit carries a live-looking credential.
 *
 * Two engines, one gate. Where `gitleaks` is on PATH it is the better scanner
 * and this gate is its runner — `gitleaks dir . --redact`, so a finding names
 * the file and never reprints the secret. Where it is not, ten patterns over
 * the tracked text answer the same question well enough to stop the leak that
 * actually happens: a token pasted into a note and committed with it.
 *
 * Which engine runs is decided HERE and not in `check.sh`, because the gate
 * applies either way — bash decides whether a gate applies, and this one always
 * does. What changes is only who answers.
 *
 * A hit is forgiven by one thing: the same line declaring itself fake. There is
 * no exception list, and there will not be one — an allow-list of paths is the
 * first place a real leak hides.
 *
 * Usage: node check-secrets.js [root] [--ignore-pattern <glob>]…
 *
 * One line per violation, `<rule>  <path>  <message>`. Exit code: 0 when
 * nothing looks live, 1 otherwise. No `--fix`: a leaked credential is rotated,
 * not reformatted.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { ignorePatternsOf, readText, trackedFiles } from './tracked-files.js';

/** The ten shapes, each with the rule id a finding is reported under. */
const PATTERNS = [
    {
        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
        rule: 'secrets-private-key',
        what: 'a private key block',
    },
    { pattern: /\bAKIA[\dA-Z]{16}\b/, rule: 'secrets-aws-key', what: 'an aws access key' },
    {
        pattern: /\bgh[oprsu]_[\dA-Za-z]{30,}\b/,
        rule: 'secrets-github-token',
        what: 'a github token',
    },
    {
        pattern: /\bxox[abprs]-[\dA-Za-z-]{10,}\b/,
        rule: 'secrets-slack-token',
        what: 'a slack token',
    },
    {
        pattern: /\btskey-[a-z]+-[\dA-Za-z]{6,}\b/,
        rule: 'secrets-tailscale-key',
        what: 'a tailscale key',
    },
    { pattern: /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\./, rule: 'secrets-jwt', what: 'a signed jwt' },
    {
        pattern: /\bglsa_[\dA-Za-z_]{20,}\b/,
        rule: 'secrets-grafana-token',
        what: 'a grafana token',
    },
    { pattern: /\bsk-[\dA-Za-z]{20,}\b/, rule: 'secrets-api-key', what: 'an api key' },
    { pattern: /\bFR\d{2} ?(?:\d{4} ?){5}/, rule: 'secrets-iban', what: 'an iban' },
    { pattern: /\bst\.[\da-f]{24,}\b/, rule: 'secrets-service-token', what: 'a service token' },
];

/** The one predicate that lets a hit through: the line must declare itself fake. */
const isSynthetic = (line) => /dummy|example|fake|redacted|sample|synthetic/i.test(line);

/** Gitleaks, when the machine has it — the better scanner, run redacted. */
function runGitleaks(root) {
    const probe = spawnSync('gitleaks', ['version'], { stdio: 'ignore' });
    if (probe.error) {
        return null;
    }

    const run = spawnSync('gitleaks', ['dir', '.', '--no-banner', '--redact', '--exit-code', '1'], {
        cwd: root,
        encoding: 'utf8',
    });

    return { output: `${run.stdout ?? ''}${run.stderr ?? ''}`, status: run.status ?? 1 };
}

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');

const gitleaks = runGitleaks(root);
if (gitleaks !== null) {
    if (gitleaks.status !== 0) {
        stdout.write(gitleaks.output);
    }
    exit(gitleaks.status === 0 ? 0 : 1);
}

let failed = false;
for (const path of trackedFiles(root, { ignorePatterns: ignorePatternsOf(argv) })) {
    const text = readText(root, path);
    if (text === null) {
        continue;
    }

    for (const [index, line] of text.split('\n').entries()) {
        if (isSynthetic(line)) {
            continue;
        }
        for (const { pattern, rule, what } of PATTERNS) {
            if (pattern.test(line)) {
                stdout.write(`${rule}  ${path}  line ${index + 1} looks like ${what}\n`);
                failed = true;
            }
        }
    }
}

exit(failed ? 1 : 0);
