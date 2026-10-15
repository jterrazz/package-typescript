import { join } from 'node:path';

import { labelOf, readBaseline, sectionOf } from '../../kit/baseline/baseline-file.js';
import type { Counts } from '../../kit/baseline/baseline-file.js';
import { suppressedCount, SUPPRESSIONS_LEDGER } from '../../kit/baseline/oxlint-suppressions.js';
import type { Pass } from '../../kit/checker/pass.js';
import { unmeasuredBrowserMutants } from '../../kit/project/browser-side.js';
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

function unmeasuredRows({ members, root }: ReturnType<typeof unmeasuredOf>): Row[] {
    const total = root + sum(members);
    if (total === 0) {
        return [];
    }

    return [
        ['unmeasured', `${String(total)} mutants (browser-side)`],
        ...Object.entries(members)
            .filter(([, held]) => held > 0)
            .map(([member, held]): Row => [`  ${member}`, `${String(held)} unmeasured mutants`]),
    ];
}

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

const unmeasuredIn = (unit: string): number => unmeasuredBrowserMutants(unit) ?? 0;

// invariant: a unit that ran no mutation holds no count, and a count of nothing is no row: the line appears only where the last run left browser-side mutants unclaimed.
function unmeasuredOf(
    root: string,
    members: readonly string[],
): { members: Record<string, number>; root: number } {
    return {
        members: Object.fromEntries(
            members.map((member) => [member, unmeasuredIn(join(root, member))]),
        ),
        root: unmeasuredIn(root),
    };
}

function declaredOf(declaration: null | ProjectIdentity, monorepo: boolean): Row[] {
    if (declaration !== null) {
        return [['declared', declaredAs(declaration)]];
    }

    return [
        [
            'declared',
            monorepo ? 'nothing — a monorepo, each member its own' : 'nothing — node, the default',
        ],
    ];
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
        unmeasured,
    }: {
        behind: readonly ToolVersion[];
        declaration: null | ProjectIdentity;
        exceptions: number;
        members: Readonly<Record<string, number>>;
        mutants: number;
        off: readonly string[];
        optOuts: readonly OptOut[];
        suppressions: number;
        unmeasured: ReturnType<typeof unmeasuredOf>;
    },
): string[] {
    const { heldOf, others } = baselineReader(root);

    return [
        ...rowsAligned([
            ...declaredOf(declaration, Object.keys(members).length > 0),
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
            ...unmeasuredRows(unmeasured),
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
        const unmeasured = unmeasuredOf(root, workspaceMembers(root));
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
                unmeasuredByMember: Object.fromEntries(
                    Object.entries(unmeasured.members).filter(([, held]) => held > 0),
                ),
                unmeasuredMutants: unmeasured.root + sum(unmeasured.members),
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
                unmeasured,
            }),
        };
    },
});
