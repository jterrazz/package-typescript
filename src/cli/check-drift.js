#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import {
    LABEL,
    labelOf,
    readBaseline,
    readRatchet,
    SECTION,
    TEST_SECTION,
} from './check-baseline.js';
import { countSuppressions } from './check-suppressions.js';
import { toolVersions } from './doctor.js';
import CONFIGS from './oxlint-config-names.json' with { type: 'json' };
import { ignorePatternsOf, orRefused } from './project-files.js';

const PACKAGE_ROOT = resolve(import.meta.dirname, '../..');

const PROFILES_AT = join(PACKAGE_ROOT, 'src/presets/oxlint/profiles');

// Read off the compiled files: loading the manifest loads every plugin the rulebook decides.
const PROFILE_NAMES = new Set(
    readdirSync(PROFILES_AT)
        .filter((name) => name.endsWith('.js'))
        .map((name) => basename(name, '.js')),
);

const REASON = /\/\/\s*reason:/iu;

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

// oxlint's config schema is closed, so a profile cannot carry its name to `--print-config`: the
// config's import is the only evidence. A project on no profile of ours never joined one.
function profileOf(source) {
    const imported =
        /import\s*\{(?<names>[^}]*)\}\s*from\s*['"]@jterrazz\/typescript\/oxlint['"]/u.exec(
            source ?? '',
        );
    const named = (imported?.groups.names ?? '').split(',').map((name) => name.trim());

    return named.find((name) => PROFILE_NAMES.has(name)) ?? null;
}

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

// The same list `tool-configs.sh` hands oxlint.
const configName = CONFIGS.find((name) => existsSync(join(root, name)));
const source = configName === undefined ? null : readFileSync(join(root, configName), 'utf8');

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

// A project on the handed default already resolved its profile.
function profileRulesOf() {
    if (profileName === null) {
        return {};
    }
    if (defaultProfile !== null) {
        return consumerRules;
    }

    return resolvedRules(root, oxlint, join(PROFILES_AT, `${profileName}.js`)) ?? {};
}

const profileRules = profileRulesOf();

const off = turnedOff(profileRules, consumerRules);
const unreasoned = off.filter((rule) => {
    const line = lineNaming(source, rule);

    return line === undefined || !REASON.test(line);
});

// A file the Oxlint pass refuses as `baseline-unreadable` holds no count either row may claim.
const isUnreadable = readRatchet(root).problem !== null;

function totalOf(section) {
    if (isUnreadable) {
        return 'unreadable';
    }
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
                config: configName === undefined ? 'default' : 'own',
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

function rulesOffLine() {
    if (profileName === null) {
        return 'not measured';
    }

    return off.length === 0 ? 'none' : `${off.length} (${off.join(', ')})`;
}

// `nothing held` is the Oxlint pass's own words.
function heldOf(section) {
    if (isUnreadable) {
        return 'unreadable';
    }
    const recorded = readBaseline(root, section) ?? {};

    return Object.keys(recorded).length === 0
        ? 'nothing held'
        : Object.values(recorded).reduce((sum, count) => sum + count, 0);
}

const LABEL_WIDTH = Math.max(LABEL.length, labelOf(TEST_SECTION).length) + 2;

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
stdout.write(row(LABEL, heldOf(SECTION)));
if (readBaseline(root, TEST_SECTION) !== null) {
    stdout.write(row(labelOf(TEST_SECTION), heldOf(TEST_SECTION)));
}
stdout.write(
    row(
        'tool versions',
        behind.length === 0
            ? 'in range'
            : behind
                  .map(({ installed, name, verdict }) =>
                      installed === null ? `${name} ${verdict}` : `${name} ${installed} ${verdict}`,
                  )
                  .join(', '),
    ),
);

for (const rule of unreasoned) {
    stdout.write(
        `\ndrift-unreasoned  ${configName ?? 'oxlint.config'}  ${rule} is off and the line that turns it off carries no '// reason:'\n`,
    );
}

exit(unreasoned.length > 0 ? 1 : 0);
