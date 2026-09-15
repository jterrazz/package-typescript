#!/usr/bin/env node

/**
 * How far this project stands from the profile it says it extends.
 *
 * Four numbers, printed at the end of every `check`, because the alternative is
 * what the estate had: twenty-eight repositories each quietly a little further
 * from the shared rulebook, and nobody able to say by how much without opening
 * twenty-eight config files. A rule turned off, a suppression written, a
 * baseline entry recorded and a tool left behind are the four ways a project
 * drifts, and each of them is a number here.
 *
 * One of the four is also a GATE. A rule the profile has on may be turned off —
 * a project knows things the profile does not — but not silently: the line that
 * turns it off carries a `// reason:` comment, or the run fails on
 * `drift-unreasoned`. The other three only ever report.
 *
 * Usage: node check-drift.js [root] [--oxlint <path>] [--json]
 *        [--ignore-pattern <glob>]…
 *
 * Exit code: 0 unless a rule is turned off with no reason beside it.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { readBaseline } from './check-baseline.js';
import { countSuppressions } from './check-suppressions.js';
import { toolVersions } from './doctor.js';
import { ignorePatternsOf } from './tracked-files.js';

const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

/** Where a consumer declares its rules, in the order oxlint looks. */
const CONFIGS = [
    'oxlint.config.ts',
    'oxlint.config.mjs',
    'oxlint.config.js',
    'oxlint.config.cjs',
    '.oxlintrc.json',
];

/** The profiles this package ships. A config that names none is not measured. */
const PROFILES = new Set(['astro', 'bun', 'expo', 'library', 'next', 'node']);

/** The comment that makes a rule turned off a decision rather than a drift. */
const REASON = /\/\/\s*reason:/i;

/** A resolved rule set, as `name -> level`, or null when oxlint refused. */
function resolvedRules(root, oxlint, configPath) {
    try {
        const printed = execFileSync(
            oxlint,
            configPath === null ? ['--print-config'] : ['-c', configPath, '--print-config'],
            { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );

        return JSON.parse(printed).rules ?? {};
    } catch {
        return null;
    }
}

/**
 * The profile a consumer config extends, read off the config's own source, or
 * null when it extends none of ours.
 *
 * The compiled rulebook is expected to carry the name, and when it does this
 * reads it from there; until then the source is the evidence — a config that
 * imports `node` from this package's oxlint entry is a `node` project.
 *
 * Null matters: a project that extends no profile of ours is not DRIFTING from
 * one, it never joined it, and reporting two hundred "rules off" would say
 * nothing about anything.
 */
function profileOf(source) {
    const compiled = /profile:\s*['"](?<name>[\w-]+)['"]/.exec(source ?? '');
    if (compiled !== null && PROFILES.has(compiled.groups.name)) {
        return compiled.groups.name;
    }

    const imported =
        /import\s*{(?<names>[^}]*)}\s*from\s*['"]@jterrazz\/typescript\/oxlint['"]/.exec(
            source ?? '',
        );
    const named = (imported?.groups.names ?? '').split(',').map((name) => name.trim());

    return named.find((name) => PROFILES.has(name)) ?? null;
}

/** A rule the profile runs and this project does not. */
function turnedOff(profile, consumer) {
    const off = [];
    for (const [rule, level] of Object.entries(profile).toSorted(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        if (level === 'allow') {
            continue;
        }
        const here = consumer[rule];
        if (here === undefined || here === 'allow') {
            off.push(rule);
        }
    }

    return off;
}

/** The line of the config that turns a rule off, when the config names it at all. */
function lineNaming(source, rule) {
    const bare = rule.split('/').at(-1);

    return (source ?? '')
        .split('\n')
        .find(
            (line) =>
                line.includes(rule) || line.includes(`'${bare}'`) || line.includes(`"${bare}"`),
        );
}

const isJson = argv.includes('--json');
const oxlintAt = argv[argv.indexOf('--oxlint') + 1];
const oxlint = argv.includes('--oxlint') && oxlintAt !== undefined ? oxlintAt : 'oxlint';
const root = resolve(
    argv.slice(2).find((argument, index) => {
        const previous = argv[index + 1];

        return (
            !argument.startsWith('--') && previous !== '--oxlint' && previous !== '--ignore-pattern'
        );
    }) ?? '.',
);

const configName = CONFIGS.find((name) => existsSync(join(root, name)));
const source = configName === undefined ? null : readFileSync(join(root, configName), 'utf8');
const profileName = profileOf(source);

const consumerRules = resolvedRules(root, oxlint, null) ?? {};
const profileRules =
    profileName === null
        ? {}
        : (resolvedRules(root, oxlint, join(PACKAGE_ROOT, 'presets/oxlint', `${profileName}.js`)) ??
          {});

const off = turnedOff(profileRules, consumerRules);
const unreasoned = off.filter((rule) => {
    const line = lineNaming(source, rule);

    return line === undefined || !REASON.test(line);
});

const baseline = readBaseline(root);
const baselineTotal =
    baseline === null ? null : Object.values(baseline).reduce((sum, count) => sum + count, 0);
const suppressions = countSuppressions(root, ignorePatternsOf(argv));
const behind = toolVersions().filter(({ verdict }) => verdict !== 'ok');

if (isJson) {
    stdout.write(
        `${JSON.stringify(
            {
                baseline: baselineTotal,
                profile: profileName,
                rulesOff: off,
                suppressions,
                tools: behind,
                unreasoned,
            },
            null,
            2,
        )}\n`,
    );
    exit(unreasoned.length > 0 ? 1 : 0);
}

/** The one line a reader looks for: what this project runs that the profile does not. */
function rulesOffLine() {
    if (profileName === null) {
        return 'not measured';
    }

    return off.length === 0 ? 'none' : `${off.length} (${off.join(', ')})`;
}

stdout.write(`  profile               ${profileName ?? "none of this package's"}\n`);
stdout.write(`  rules off vs profile  ${rulesOffLine()}\n`);
stdout.write(`  suppressions          ${suppressions}\n`);
stdout.write(`  baseline              ${baselineTotal === null ? 'absent' : baselineTotal}\n`);
stdout.write(
    `  tool versions         ${
        behind.length === 0
            ? 'in range'
            : behind
                  .map(({ installed, name, verdict }) => `${name} ${installed} ${verdict}`)
                  .join(', ')
    }\n`,
);

for (const rule of unreasoned) {
    stdout.write(
        `\ndrift-unreasoned  ${configName ?? 'oxlint.config'}  ${rule} is off and the line that turns it off carries no '// reason:'\n`,
    );
}

exit(unreasoned.length > 0 ? 1 : 0);
