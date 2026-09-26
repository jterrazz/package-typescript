#!/usr/bin/env node

// Only the line declaring itself fake is forgiven: an allow-list of paths is where a real leak hides.

import { spawnSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { ignorePatternsOf, orRefused, projectFiles, readText } from '../reading/project-files.js';

const PATTERNS = [
    {
        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
        rule: 'secrets/no-private-key',
        what: 'a private key block',
    },
    { pattern: /\bAKIA[\dA-Z]{16}\b/u, rule: 'secrets/no-aws-key', what: 'an aws access key' },
    {
        pattern: /\bgh[oprsu]_[\dA-Za-z]{30,}\b/u,
        rule: 'secrets/no-github-token',
        what: 'a github token',
    },
    {
        pattern: /\bxox[abprs]-[\dA-Za-z-]{10,}\b/u,
        rule: 'secrets/no-slack-token',
        what: 'a slack token',
    },
    {
        pattern: /\btskey-[a-z]+-[\dA-Za-z]{6,}\b/u,
        rule: 'secrets/no-tailscale-key',
        what: 'a tailscale key',
    },
    {
        pattern: /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\./u,
        rule: 'secrets/no-signed-jwt',
        what: 'a signed jwt',
    },
    {
        pattern: /\bglsa_[\dA-Za-z_]{20,}\b/u,
        rule: 'secrets/no-grafana-token',
        what: 'a grafana token',
    },
    { pattern: /\bsk-[\dA-Za-z]{20,}\b/u, rule: 'secrets/no-api-key', what: 'an api key' },
    { pattern: /\bFR\d{2} ?(?:\d{4} ?){5}/u, rule: 'secrets/no-iban', what: 'an iban' },
    { pattern: /\bst\.[\da-f]{24,}\b/u, rule: 'secrets/no-service-token', what: 'a service token' },
];

const isSynthetic = (line) => /dummy|example|fake|redacted|sample|synthetic/iu.test(line);

// gitleaks reads a directory, so the judged files are copied into one, each at the project's own path.
function stageFiles(root, files) {
    const staged = mkdtempSync(join(tmpdir(), 'typescript-secrets-'));
    for (const path of files) {
        const source = join(root, path);
        try {
            if (!lstatSync(source).isFile()) {
                continue;
            }
            mkdirSync(dirname(join(staged, path)), { recursive: true });
            copyFileSync(source, join(staged, path));
        } catch {
            // A file gone from the disk has nothing left to leak.
        }
    }

    return staged;
}

function runGitleaks(root, files) {
    const probe = spawnSync('gitleaks', ['version'], { stdio: 'ignore' });
    if (probe.error) {
        return null;
    }

    const staged = stageFiles(root, files);
    try {
        const run = spawnSync(
            'gitleaks',
            ['dir', '.', '--no-banner', '--redact', '--exit-code', '1'],
            { cwd: staged, encoding: 'utf8' },
        );

        return { output: `${run.stdout ?? ''}${run.stderr ?? ''}`, status: run.status ?? 1 };
    } finally {
        rmSync(staged, { force: true, recursive: true });
    }
}

const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
const files = orRefused(() => projectFiles(root, { ignorePatterns: ignorePatternsOf(argv) }));

const gitleaks = runGitleaks(root, files);
if (gitleaks !== null) {
    if (gitleaks.status !== 0) {
        stdout.write(gitleaks.output);
    }
    exit(gitleaks.status === 0 ? 0 : 1);
}

let failed = false;
for (const path of files) {
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
