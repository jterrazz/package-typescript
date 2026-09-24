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
 * A project with no config of its own is measured against the one `check`
 * hands its linter, given here with `-c`: the toolchain's default profile.
 *
 * Usage: node check-drift.js [root] [--oxlint <path>] [-c <default-config>]
 *        [--json] [--ignore-pattern <glob>]…
 *
 * Exit code: 0 unless a rule is turned off with no reason beside it.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { LABEL, labelOf, readBaseline, TEST_SECTION } from './check-baseline.js';
import { countSuppressions } from './check-suppressions.js';
import { toolVersions } from './doctor.js';
import CONFIGS from './oxlint-config-names.json' with { type: 'json' };
import { ignorePatternsOf, orRefused } from './project-files.js';

const PACKAGE_ROOT = resolve(import.meta.dirname, '../..');

/** Where the profiles this package ships sit, compiled — one `<name>.js` each. */
const PROFILES_AT = join(PACKAGE_ROOT, 'src/presets/oxlint/profiles');

/**
 * The profiles this package ships, read off their compiled files rather than
 * the manifest: the report measures against those files, and loading the
 * manifest loads every plugin the rulebook decides.
 */
const PROFILE_NAMES = new Set(
    readdirSync(PROFILES_AT)
        .filter((name) => name.endsWith('.js'))
        .map((name) => basename(name, '.js')),
);

/** The comment that makes a rule turned off a decision rather than a drift. */
const REASON = /\/\/\s*reason:/iu;

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
 * The SOURCE is the evidence, and it is the only evidence available: oxlint's
 * config schema is closed — an unknown top-level key makes it print `Failed to
 * parse oxlint configuration file` — so a compiled profile cannot carry its own
 * name through to `--print-config`. A config that imports `node` from this
 * package's oxlint entry is a `node` project, and that import is what this
 * reads.
 *
 * Null matters: a project that extends no profile of ours is not DRIFTING from
 * one, it never joined it, and reporting two hundred "rules off" would say
 * nothing about anything.
 */
function profileOf(source) {
    const imported =
        /import\s*\{(?<names>[^}]*)\}\s*from\s*['"]@jterrazz\/typescript\/oxlint['"]/u.exec(
            source ?? '',
        );
    const named = (imported?.groups.names ?? '').split(',').map((name) => name.trim());

    return named.find((name) => PROFILE_NAMES.has(name)) ?? null;
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
const handedAt = argv[argv.indexOf('-c') + 1];
const handed = argv.includes('-c') && handedAt !== undefined ? resolve(handedAt) : null;
const root = resolve(
    argv.slice(2).find((argument, index) => {
        const previous = argv[index + 1];

        return (
            !argument.startsWith('-') &&
            previous !== '--oxlint' &&
            previous !== '--ignore-pattern' &&
            previous !== '-c'
        );
    }) ?? '.',
);

// CONFIGS is `oxlint-config-names.json`'s — the same list `tool-configs.sh`
// hands oxlint, so a project counts as having a config here exactly when
// `check`/`fix` treat it as having one.
const configName = CONFIGS.find((name) => existsSync(join(root, name)));
const source = configName === undefined ? null : readFileSync(join(root, configName), 'utf8');

/** The profile the handed default IS, when the project runs on it: one of this package's, by file name. */
const handedName = handed === null ? null : basename(handed, '.js');
const defaultProfile =
    configName === undefined &&
    handed !== null &&
    dirname(handed) === PROFILES_AT &&
    PROFILE_NAMES.has(handedName)
        ? handedName
        : null;
const profileName = defaultProfile ?? profileOf(source);

const consumerRules = resolvedRules(root, oxlint, configName === undefined ? handed : null) ?? {};
const profileRules =
    profileName === null
        ? {}
        : (resolvedRules(root, oxlint, join(PROFILES_AT, `${profileName}.js`)) ?? {});

const off = turnedOff(profileRules, consumerRules);
const unreasoned = off.filter((rule) => {
    const line = lineNaming(source, rule);

    return line === undefined || !REASON.test(line);
});

/** A ratchet section's total, or null when the project records nothing there. */
function totalOf(section) {
    const recorded = readBaseline(root, section);

    return recorded === null
        ? null
        : Object.values(recorded).reduce((sum, count) => sum + count, 0);
}

const baselineTotal = totalOf();
const testBaselineTotal = totalOf(TEST_SECTION);
const suppressions = orRefused(() => countSuppressions(root, ignorePatternsOf(argv)));
const behind = toolVersions().filter(({ verdict }) => verdict !== 'ok');

if (isJson) {
    stdout.write(
        `${JSON.stringify(
            {
                baseline: baselineTotal,
                profile: profileName,
                rulesOff: off,
                suppressions,
                testBaseline: testBaselineTotal,
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

/* The longest label is a ratchet section's, so every row aligns to it. */
const LABEL_WIDTH = Math.max(LABEL.length, labelOf(TEST_SECTION).length) + 2;

/** One row of the block: a label, padded to the widest one, then its value. */
function row(label, value) {
    return `  ${label.padEnd(LABEL_WIDTH)}${value}\n`;
}

stdout.write(
    row(
        'profile',
        defaultProfile === null
            ? (profileName ?? "none of this package's")
            : `${defaultProfile} (the default — no config of its own)`,
    ),
);
stdout.write(row('rules off vs profile', rulesOffLine()));
stdout.write(row('suppressions', suppressions));
stdout.write(row(LABEL, baselineTotal === null ? 'absent' : baselineTotal));
if (testBaselineTotal !== null) {
    stdout.write(row(labelOf(TEST_SECTION), testBaselineTotal));
}
stdout.write(
    row(
        'tool versions',
        behind.length === 0
            ? 'in range'
            : behind
                  .map(({ installed, name, verdict }) => `${name} ${installed} ${verdict}`)
                  .join(', '),
    ),
);

for (const rule of unreasoned) {
    stdout.write(
        `\ndrift-unreasoned  ${configName ?? 'oxlint.config'}  ${rule} is off and the line that turns it off carries no '// reason:'\n`,
    );
}

exit(unreasoned.length > 0 ? 1 : 0);
