import { basename, dirname, join, resolve } from 'node:path';

import { labelOf, readBaseline, sectionOf } from '../../engine/baseline/baseline-file.js';
import type { Counts } from '../../engine/baseline/baseline-file.js';
import { OXLINT_SUPPRESSIONS, suppressedCount } from '../../engine/baseline/oxlint-suppressions.js';
import { BASELINE_SECTION as SECTION } from '../catalogue/preset.js';
import type { Context, Finding, Pass } from '../../engine/checker/pass.js';
import { countSuppressions } from '../../engine/project/comments.js';
import CONFIGS from '../../engine/project/oxlint-config-names.json' with { type: 'json' };
import { printedOxlintConfig } from '../../engine/project/oxlint-config.js';
import type { PrintedRules } from '../../engine/project/oxlint-config.js';
import type { OptOut } from '../../engine/project/preset.js';
import { orRefused } from '../../engine/project/project-files.js';
import { toolVersions } from '../../engine/project/tool-versions.js';
import type { ToolVersion } from '../../engine/project/tool-versions.js';

type Project = {
    configName: string | undefined;
    consumerConfig: null | string;
    defaultProfile: null | string;
    profileName: null | string;
    source: null | string;
};

const REASON = /\/\/\s*reason:/iu;

const FROM_PRESETS = 'fromPresets';

const resolvedRules = (
    root: string,
    oxlint: string,
    configPath: null | string,
): null | PrintedRules => printedOxlintConfig(root, oxlint, configPath)?.rules ?? null;

// oxlint's config schema is closed, so a profile cannot carry its name to `--print-config`: the
// config's import is the only evidence — a profile imported by name, or the one `fromPresets` reads off the settings.
function profileOf(
    source: null | string,
    { profileNames, settled }: { profileNames: ReadonlySet<string>; settled: unknown },
): null | string {
    const imported =
        /import\s*\{(?<names>[^}]*)\}\s*from\s*['"]@jterrazz\/typescript\/oxlint['"]/u.exec(
            source ?? '',
        );
    const named = (imported?.groups?.names ?? '').split(',').map((name) => name.trim());
    if (named.includes(FROM_PRESETS)) {
        return typeof settled === 'string' && profileNames.has(settled) ? settled : null;
    }

    return named.find((name) => profileNames.has(name)) ?? null;
}

function turnedOff(profile: PrintedRules, consumer: PrintedRules): string[] {
    const off: string[] = [];
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

function lineNaming(source: null | string, rule: string): string | undefined {
    const bare = rule.split('/').at(-1) ?? rule;

    return (source ?? '')
        .split('\n')
        .find(
            (line) =>
                line.includes(rule) || line.includes(`'${bare}'`) || line.includes(`"${bare}"`),
        );
}

const LABEL_WIDTH = labelOf(SECTION).length + 2;

type Row = [label: string, value: number | string];

const rowsAligned = (rows: readonly Row[]): string[] => {
    const width = Math.max(LABEL_WIDTH, ...rows.map(([label]) => label.length + 2));

    return rows.map(([label, value]) => `  ${label.padEnd(width)}${value}`);
};

function toolsLine(behind: readonly ToolVersion[]): string {
    return behind.length === 0
        ? 'in range'
        : behind
              .map(({ installed, name, verdict }) =>
                  installed === null ? `${name} ${verdict}` : `${name} ${installed} ${verdict}`,
              )
              .join(', ');
}

// Read off the compiled files: loading the manifest loads every plugin the rulebook decides.
function profileNamesAt(context: Context, profilesAt: null | string): ReadonlySet<string> {
    return new Set(
        profilesAt === null
            ? []
            : (context.list(profilesAt) ?? [])
                  .filter((name) => name.endsWith('.js'))
                  .map((name) => basename(name, '.js')),
    );
}

function profileOfProject(
    context: Context,
    profilesAt: null | string,
    { profileNames, settled }: { profileNames: ReadonlySet<string>; settled: unknown },
): Project {
    const handedAt = context.value('-c');
    const handed = handedAt === undefined ? null : resolve(handedAt);
    // The same list the command hands oxlint.
    const configName = CONFIGS.find((name) => context.exists(join(context.root, name)));
    const source = configName === undefined ? null : context.read(join(context.root, configName));
    const handedName = handed === null ? null : basename(handed, '.js');
    const defaultProfile =
        configName === undefined &&
        handed !== null &&
        handedName !== null &&
        dirname(handed) === profilesAt &&
        profileNames.has(handedName)
            ? handedName
            : null;

    return {
        configName,
        consumerConfig: configName === undefined ? handed : null,
        defaultProfile,
        profileName: defaultProfile ?? profileOf(source, { profileNames, settled }),
        source,
    };
}

function offOf(
    context: Context,
    project: Project,
    profilesAt: null | string,
): { off: string[]; unreasoned: string[] } {
    const { root } = context;
    const oxlint = context.value('--oxlint', 'oxlint');
    const consumerRules = resolvedRules(root, oxlint, project.consumerConfig) ?? {};
    // A project on the handed default already resolved its profile.
    const profileRules =
        project.profileName === null
            ? {}
            : project.defaultProfile === null
              ? (resolvedRules(root, oxlint, join(profilesAt ?? '', `${project.profileName}.js`)) ??
                {})
              : consumerRules;
    const off = turnedOff(profileRules, consumerRules);
    const unreasoned = off.filter((rule) => {
        const line = lineNaming(project.source, rule);

        return line === undefined || !REASON.test(line);
    });

    return { off, unreasoned };
}

const sum = (recorded: Counts): number =>
    Object.values(recorded).reduce((total, count) => total + count, 0);

// A file the Oxlint pass refuses as `baseline-unreadable` holds no count any row may claim; a floor is no debt, so its measures are counted and never summed.
function baselineReader(
    root: string,
    floors: ReadonlySet<string>,
): {
    heldOf: (section: string) => number | string;
    others: string[];
    totalOf: (section: string) => null | number | string;
} {
    const { problem, sections } = readBaseline(root);
    const totalOf = (section: string): null | number | string => {
        const recorded = problem === null ? sectionOf(root, section) : {};
        if (problem !== null || recorded === null) {
            return problem === null ? null : 'unreadable';
        }

        return floors.has(section) ? Object.keys(recorded).length : sum(recorded);
    };

    return {
        heldOf: (section) => {
            const total = totalOf(section);
            if (total === null || Object.keys(sectionOf(root, section) ?? {}).length === 0) {
                return typeof total === 'string' ? total : 'nothing held';
            }

            return floors.has(section) ? `a floor of ${String(total)} measure(s)` : total;
        },
        others: Object.keys(sections ?? {})
            .filter((section) => section !== SECTION)
            .toSorted(),
        totalOf,
    };
}

function rulesOffOf(profileName: null | string, off: readonly string[]): string {
    if (profileName === null) {
        return 'not measured';
    }

    return off.length === 0 ? 'none' : `${off.length} (${off.join(', ')})`;
}

function rowsOf(
    root: string,
    {
        behind,
        findings,
        floors,
        off,
        optOuts,
        project,
        suppressions,
    }: {
        behind: readonly ToolVersion[];
        findings: readonly Finding[];
        floors: ReadonlySet<string>;
        off: readonly string[];
        optOuts: readonly OptOut[];
        project: Project;
        suppressions: number;
    },
): string[] {
    const { heldOf, others } = baselineReader(root, floors);

    return [
        ...rowsAligned([
            [
                'profile',
                project.defaultProfile === null
                    ? (project.profileName ?? "none of this package's")
                    : `${project.defaultProfile} (the default — no config of its own)`,
            ],
            ['rules off vs profile', rulesOffOf(project.profileName, off)],
            ...(optOuts.length === 0
                ? []
                : [
                      [
                          'laws set aside',
                          `${String(optOuts.length)} (${optOuts.map(({ law }) => law).join(', ')})`,
                      ] satisfies Row,
                  ]),
            ['suppressions', suppressions],
            [OXLINT_SUPPRESSIONS, suppressedCount(root) ?? 'nothing held'],
            ...[SECTION, ...others].map((section): Row => [labelOf(section), heldOf(section)]),
            ['tool versions', toolsLine(behind)],
        ]),
        ...(findings.length > 0 ? [''] : []),
    ];
}

export const drift: Pass = Object.freeze({
    async check(context) {
        const { root } = context;
        const profilesFlag = context.value('--profiles');
        const profilesAt = profilesFlag === undefined ? null : resolve(profilesFlag);
        const { resolved } = await context.config();
        const project = profileOfProject(context, profilesAt, {
            profileNames: profileNamesAt(context, profilesAt),
            settled: resolved.sections.typescript?.profile,
        });
        const { off, unreasoned } = offOf(context, project, profilesAt);
        const suppressions = orRefused(() => countSuppressions(root, context.ignorePatterns));
        const behind = toolVersions().filter(({ verdict }) => verdict !== 'ok');
        const { optOuts } = resolved;
        const floors = new Set(resolved.floors);
        const { others, totalOf } = baselineReader(root, floors);
        const totals = (kept: (section: string) => boolean): Record<string, unknown> =>
            Object.fromEntries(
                others
                    .filter((section) => kept(section))
                    .map((section) => [section, totalOf(section)]),
            );
        const findings: Finding[] = unreasoned.map((rule) => ({
            message: `${rule} is off and the line that turns it off carries no '// reason:'`,
            path: project.configName ?? 'oxlint.config',
            rule: 'drift/off-rule-states-its-reason',
        }));

        return {
            findings,
            json: {
                baseline: totalOf(SECTION),
                config: project.configName === undefined ? 'default' : 'own',
                floors: totals((section) => floors.has(section)),
                optOuts,
                oxlintSuppressions: suppressedCount(root),
                profile: project.profileName,
                rulesOff: off,
                suppressions,
                sections: totals((section) => !floors.has(section)),
                tools: behind,
                unreasoned,
            },
            lines: rowsOf(root, { behind, findings, floors, off, optOuts, project, suppressions }),
        };
    },
    valued: ['--oxlint', '-c', '--profiles'],
});
