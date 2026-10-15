import { labelOf } from '../../kit/baseline/baseline-file.js';
import type { Counts } from '../../kit/baseline/baseline-file.js';
import { SUPPRESSIONS_LEDGER } from '../../kit/baseline/oxlint-suppressions.js';
import type { OptOut } from '../../kit/project/opt-outs.js';
import { declaredAs } from '../../kit/project/project-kind.js';
import type { ProjectIdentity } from '../../kit/project/project-kind.js';
import type { ToolVersion } from '../../kit/project/tool-versions.js';
import { BASELINE_SECTION as SECTION } from '../catalogue/preset.js';

const LABEL_WIDTH = labelOf(SECTION).length + 2;

type Row = [label: string, value: number | string];

/** The browser-side mutants the last mutation run left unclaimed, at the root and in each member. */
export type Unmeasured = { members: Record<string, number>; root: number };

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

export const sum = (recorded: Counts): number =>
    Object.values(recorded).reduce((total, count) => total + count, 0);

const rulesOffOf = (off: readonly string[]): string =>
    off.length === 0 ? 'none' : `${off.length} (${off.join(', ')})`;

// invariant: a Stryker directive declares mutants, not a lint rule off: it is counted beside the suppressions, never into them, and the row reads as before where a project holds none.
const suppressionsLine = (suppressions: number, mutants: number): number | string =>
    mutants === 0
        ? suppressions
        : `${String(suppressions)} + ${String(mutants)} mutation directives`;

function unmeasuredRows({ members, root }: Unmeasured): Row[] {
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

/** What a project holds against its laws, each count read already: the rows of the drift report are written from it alone. */
export type DriftCounts = {
    behind: readonly ToolVersion[];
    declaration: null | ProjectIdentity;
    exceptions: number;
    /** Each section of the baseline, the preset's first, with what it holds. */
    held: readonly (readonly [section: string, held: number | string])[];
    ledger: number | string;
    members: Readonly<Record<string, number>>;
    mutants: number;
    off: readonly string[];
    optOuts: readonly OptOut[];
    suppressions: number;
    unmeasured: Unmeasured;
};

/** The drift report's lines, one aligned row per count. */
export function driftLines({
    behind,
    declaration,
    exceptions,
    held,
    ledger,
    members,
    mutants,
    off,
    optOuts,
    suppressions,
    unmeasured,
}: DriftCounts): string[] {
    return rowsAligned([
        ...declaredOf(declaration, Object.keys(members).length > 0),
        ['exceptions', exceptions + sum(members)],
        ...Object.entries(members)
            .filter(([, count]) => count > 0)
            .map(([member, count]): Row => [`  ${member}`, `${String(count)} exceptions`]),
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
        [SUPPRESSIONS_LEDGER, ledger],
        ...held.map(([section, count]): Row => [labelOf(section), count]),
        ['tool versions', toolsLine(behind)],
    ]);
}
