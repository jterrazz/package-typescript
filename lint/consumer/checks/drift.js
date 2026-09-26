import { basename, dirname, join, resolve } from 'node:path';

import {
    LABEL,
    labelOf,
    readBaseline,
    readRatchet,
    SECTION,
    TEST_SECTION,
} from '../../engine/baseline/ratchet.js';
import { countSuppressions } from '../../engine/project/comments.js';
import CONFIGS from '../../engine/project/oxlint-config-names.json' with { type: 'json' };
import { printedOxlintConfig } from '../../engine/project/oxlint-config.js';
import { orRefused } from '../../engine/project/project-files.js';
import { toolVersions } from '../../engine/project/tool-versions.js';

const REASON = /\/\/\s*reason:/iu;

const resolvedRules = (root, oxlint, configPath) =>
    printedOxlintConfig(root, oxlint, configPath)?.rules ?? null;

// oxlint's config schema is closed, so a profile cannot carry its name to `--print-config`: the
// config's import is the only evidence. A project on no profile of ours never joined one.
function profileOf(source, profileNames) {
    const imported =
        /import\s*\{(?<names>[^}]*)\}\s*from\s*['"]@jterrazz\/typescript\/oxlint['"]/u.exec(
            source ?? '',
        );
    const named = (imported?.groups.names ?? '').split(',').map((name) => name.trim());

    return named.find((name) => profileNames.has(name)) ?? null;
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

const LABEL_WIDTH = Math.max(LABEL.length, labelOf(TEST_SECTION).length) + 2;

const row = (label, value) => `  ${label.padEnd(LABEL_WIDTH)}${value}`;

function toolsLine(behind) {
    return behind.length === 0
        ? 'in range'
        : behind
              .map(({ installed, name, verdict }) =>
                  installed === null ? `${name} ${verdict}` : `${name} ${installed} ${verdict}`,
              )
              .join(', ');
}

// Read off the compiled files: loading the manifest loads every plugin the rulebook decides.
function profileNamesAt(context, profilesAt) {
    return new Set(
        profilesAt === null
            ? []
            : (context.list(profilesAt) ?? [])
                  .filter((name) => name.endsWith('.js'))
                  .map((name) => basename(name, '.js')),
    );
}

function profileOfProject(context, profilesAt, profileNames) {
    const handedAt = context.value('-c');
    const handed = handedAt === undefined ? null : resolve(handedAt);
    // The same list `tool-configs.sh` hands oxlint.
    const configName = CONFIGS.find((name) => context.exists(join(context.root, name)));
    const source = configName === undefined ? null : context.read(join(context.root, configName));
    const handedName = handed === null ? null : basename(handed, '.js');
    const defaultProfile =
        configName === undefined &&
        handed !== null &&
        dirname(handed) === profilesAt &&
        profileNames.has(handedName)
            ? handedName
            : null;

    return {
        configName,
        consumerConfig: configName === undefined ? handed : null,
        defaultProfile,
        profileName: defaultProfile ?? profileOf(source, profileNames),
        source,
    };
}

function offOf(context, project, profilesAt) {
    const { root } = context;
    const oxlint = context.value('--oxlint', 'oxlint');
    const consumerRules = resolvedRules(root, oxlint, project.consumerConfig) ?? {};
    // A project on the handed default already resolved its profile.
    const profileRules =
        project.profileName === null
            ? {}
            : project.defaultProfile === null
              ? (resolvedRules(root, oxlint, join(profilesAt, `${project.profileName}.js`)) ?? {})
              : consumerRules;
    const off = turnedOff(profileRules, consumerRules);
    const unreasoned = off.filter((rule) => {
        const line = lineNaming(project.source, rule);

        return line === undefined || !REASON.test(line);
    });

    return { off, unreasoned };
}

const sum = (recorded) => Object.values(recorded).reduce((total, count) => total + count, 0);

// A file the Oxlint pass refuses as `baseline-unreadable` holds no count either row may claim.
function baselineReader(root) {
    const isUnreadable = readRatchet(root).problem !== null;

    return {
        // `nothing held` is the Oxlint pass's own words.
        heldOf: (section) => {
            if (isUnreadable) {
                return 'unreadable';
            }
            const recorded = readBaseline(root, section) ?? {};

            return Object.keys(recorded).length === 0 ? 'nothing held' : sum(recorded);
        },
        totalOf: (section) => {
            if (isUnreadable) {
                return 'unreadable';
            }
            const recorded = readBaseline(root, section);

            return recorded === null ? null : sum(recorded);
        },
    };
}

function rulesOffOf(profileName, off) {
    if (profileName === null) {
        return 'not measured';
    }

    return off.length === 0 ? 'none' : `${off.length} (${off.join(', ')})`;
}

function rowsOf(root, { behind, findings, off, project, suppressions }) {
    const { heldOf } = baselineReader(root);

    return [
        row(
            'profile',
            project.defaultProfile === null
                ? (project.profileName ?? "none of this package's")
                : `${project.defaultProfile} (the default — no config of its own)`,
        ),
        row('rules off vs profile', rulesOffOf(project.profileName, off)),
        row('suppressions', suppressions),
        row(LABEL, heldOf(SECTION)),
        ...(readBaseline(root, TEST_SECTION) === null
            ? []
            : [row(labelOf(TEST_SECTION), heldOf(TEST_SECTION))]),
        row('tool versions', toolsLine(behind)),
        ...(findings.length > 0 ? [''] : []),
    ];
}

export const drift = Object.freeze({
    check(context) {
        const { root } = context;
        const profilesFlag = context.value('--profiles');
        const profilesAt = profilesFlag === undefined ? null : resolve(profilesFlag);
        const project = profileOfProject(context, profilesAt, profileNamesAt(context, profilesAt));
        const { off, unreasoned } = offOf(context, project, profilesAt);
        const { totalOf } = baselineReader(root);
        const suppressions = orRefused(() => countSuppressions(root, context.ignorePatterns));
        const behind = toolVersions().filter(({ verdict }) => verdict !== 'ok');
        const findings = unreasoned.map((rule) => ({
            message: `${rule} is off and the line that turns it off carries no '// reason:'`,
            path: project.configName ?? 'oxlint.config',
            rule: 'drift/off-rule-states-its-reason',
        }));

        return {
            findings,
            json: {
                baseline: totalOf(),
                config: project.configName === undefined ? 'default' : 'own',
                profile: project.profileName,
                rulesOff: off,
                suppressions,
                testBaseline: totalOf(TEST_SECTION),
                tools: behind,
                unreasoned,
            },
            lines: rowsOf(root, { behind, findings, off, project, suppressions }),
        };
    },
    valued: ['--oxlint', '-c', '--profiles'],
});
