import { join } from 'node:path';

import { labelOf, readBaseline, sectionOf } from '../../kit/baseline/baseline-file.js';
import type { Counts } from '../../kit/baseline/baseline-file.js';
import { suppressedCount, SUPPRESSIONS_LEDGER } from '../../kit/baseline/oxlint-suppressions.js';
import type { Pass } from '../../kit/checker/pass.js';
import { countStrykerDirectives, countSuppressions } from '../../kit/project/comments.js';
import { exceptionsIn } from '../../kit/project/exceptions.js';
import { objectOf } from '../../kit/project/json.js';
import type { OptOut } from '../../kit/project/opt-outs.js';
import { orRefused } from '../../kit/project/project-files.js';
import { declaredAs } from '../../kit/project/project-kind.js';
import type { ProjectIdentity } from '../../kit/project/project-kind.js';
import { levelOf, projectOxlintOf } from '../../kit/project/project-oxlint.js';
import { toolVersions } from '../../kit/project/tool-versions.js';
import type { ToolVersion } from '../../kit/project/tool-versions.js';
import { workspaceMembers } from '../../kit/project/workspace-members.js';
import { BASELINE_SECTION as SECTION } from '../catalogue/preset.js';

const OFF: ReadonlySet<unknown> = new Set(['allow', 'off', 0]);

function offOf(section: unknown): string[] {
    const { overrides, rules } = projectOxlintOf(section);
    const off = [
        ...Object.entries(rules),
        ...overrides.flatMap((override) => Object.entries(override.rules)),
    ]
        .filter(([, setting]) => OFF.has(levelOf(setting)))
        .map(([rule]) => rule);

    return [...new Set(off)].toSorted();
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

const sum = (recorded: Counts): number =>
    Object.values(recorded).reduce((total, count) => total + count, 0);

// invariant: a file the Oxlint pass refuses as `baseline-unreadable` holds no count any row may claim.
function baselineReader(root: string): {
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

        return sum(recorded);
    };

    return {
        heldOf: (section) => {
            const total = totalOf(section);
            if (total === null || Object.keys(sectionOf(root, section) ?? {}).length === 0) {
                return typeof total === 'string' ? total : 'nothing held';
            }

            return total;
        },
        others: Object.keys(sections ?? {})
            .filter((section) => section !== SECTION)
            .toSorted(),
        totalOf,
    };
}

const rulesOffOf = (off: readonly string[]): string =>
    off.length === 0 ? 'none' : `${off.length} (${off.join(', ')})`;

// invariant: a Stryker directive declares mutants, not a lint rule off: it is counted beside the suppressions, never into them, and the row reads as before where a project holds none.
const suppressionsLine = (suppressions: number, mutants: number): number | string =>
    mutants === 0
        ? suppressions
        : `${String(suppressions)} + ${String(mutants)} mutation directives`;

async function membersExceptions(
    root: string,
    config: (unit?: string) => Promise<{ resolved: { own: unknown } }>,
): Promise<Record<string, number>> {
    const held = await Promise.all(
        workspaceMembers(root).map(async (member) => {
            const { resolved } = await config(join(root, member));

            return [member, exceptionsIn(resolved.own)] as const;
        }),
    );

    return Object.fromEntries(held);
}

function declaredOf(declaration: null | ProjectIdentity): Row[] {
    return declaration === null
        ? [['declared', 'nothing — node, the default']]
        : [['declared', declaredAs(declaration)]];
}

function rowsOf(
    root: string,
    {
        behind,
        declaration,
        exceptions,
        members,
        mutants,
        off,
        optOuts,
        suppressions,
    }: {
        behind: readonly ToolVersion[];
        declaration: null | ProjectIdentity;
        exceptions: number;
        members: Readonly<Record<string, number>>;
        mutants: number;
        off: readonly string[];
        optOuts: readonly OptOut[];
        suppressions: number;
    },
): string[] {
    const { heldOf, others } = baselineReader(root);

    return [
        ...rowsAligned([
            ...declaredOf(declaration),
            ['exceptions', exceptions + sum(members)],
            ...Object.entries(members)
                .filter(([, held]) => held > 0)
                .map(([member, held]): Row => [`  ${member}`, `${String(held)} exceptions`]),
            ['rules off vs profile', rulesOffOf(off)],
            ...(optOuts.length === 0
                ? []
                : [
                      [
                          'laws set aside',
                          `${String(optOuts.length)} (${optOuts.map(({ law }) => law).join(', ')})`,
                      ] satisfies Row,
                  ]),
            ['suppressions', suppressionsLine(suppressions, mutants)],
            [SUPPRESSIONS_LEDGER, suppressedCount(root) ?? 'nothing held'],
            ...[SECTION, ...others].map((section): Row => [labelOf(section), heldOf(section)]),
            ['tool versions', toolsLine(behind)],
        ]),
    ];
}

export const drift: Pass = Object.freeze({
    async check(context) {
        const { root } = context;
        const { resolved } = await context.config();
        const { declaration, optOuts, own } = resolved;
        const off = offOf(objectOf(own.typescript).oxlint);
        const exceptions = exceptionsIn(own);
        const verbatim = await context.verbatim();
        const suppressions = orRefused(() => countSuppressions(root, verbatim));
        const mutants = orRefused(() => countStrykerDirectives(root, verbatim));
        const members = await membersExceptions(root, context.config);
        const behind = toolVersions().filter(({ verdict }) => verdict !== 'ok');
        const { others, totalOf } = baselineReader(root);

        return {
            json: {
                baseline: totalOf(SECTION),
                declaration,
                exceptions: exceptions + sum(members),
                members,
                mutationDirectives: mutants,
                optOuts,
                oxlintSuppressions: suppressedCount(root),
                rulesOff: off,
                suppressions,
                sections: Object.fromEntries(others.map((section) => [section, totalOf(section)])),
                tools: behind,
            },
            lines: rowsOf(root, {
                behind,
                declaration,
                exceptions,
                members,
                mutants,
                off,
                optOuts,
                suppressions,
            }),
        };
    },
});
