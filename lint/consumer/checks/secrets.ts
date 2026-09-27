// Only the line declaring itself fake is forgiven: an allow-list of paths is where a real leak hides.

import type { Finding, Pass } from '../../engine/checker/pass.js';
import { runGitleaks } from '../../engine/checker/tool-run.js';
import { readText } from '../../engine/project/project-files.js';

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

const isSynthetic = (line: string): boolean =>
    /dummy|example|fake|redacted|sample|synthetic/iu.test(line);

function patternFindings(root: string, files: readonly string[]): Finding[] {
    const findings: Finding[] = [];
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
                    findings.push({
                        line: index + 1,
                        message: `line ${index + 1} looks like ${what}`,
                        path,
                        rule,
                    });
                }
            }
        }
    }

    return findings;
}

export const secrets: Pass = Object.freeze({
    check(context) {
        const files = context.files();
        const gitleaks = runGitleaks(context.root, files);
        if (gitleaks !== null) {
            return {
                failed: gitleaks.status !== 0,
                lines: gitleaks.status === 0 ? [] : [gitleaks.output.replace(/\n$/u, '')],
            };
        }

        return { findings: patternFindings(context.root, files) };
    },
});
