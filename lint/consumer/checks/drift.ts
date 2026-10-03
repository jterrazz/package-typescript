import { labelOf, readBaseline, sectionOf } from '../../kit/baseline/baseline-file.js';
import type { Counts } from '../../kit/baseline/baseline-file.js';
import { suppressedCount, SUPPRESSIONS_LEDGER } from '../../kit/baseline/oxlint-suppressions.js';
import type { Pass } from '../../kit/checker/pass.js';
import { countSuppressions } from '../../kit/project/comments.js';
import type { Declaration } from '../../kit/project/declaration.js';
import { objectOf } from '../../kit/project/json.js';
import type { OptOut } from '../../kit/project/preset.js';
import { orRefused } from '../../kit/project/project-files.js';
import { levelOf, projectOxlintOf } from '../../kit/project/project-oxlint.js';
import { toolVersions } from '../../kit/project/tool-versions.js';
import type { ToolVersion } from '../../kit/project/tool-versions.js';
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

const rulesOffOf = (off: readonly string[]): string =>
    off.length === 0 ? 'none' : `${off.length} (${off.join(', ')})`;

function declaredOf(declaration: Declaration | null): Row[] {
    return declaration === null
        ? [['declared', 'nothing — node, the default']]
        : [
              [
                  'declared',
                  `${declaration.kind} on ${declaration.platform ?? "its members' platforms"}`,
              ],
          ];
}

function rowsOf(
    root: string,
    {
        behind,
        declaration,
        floors,
        off,
        optOuts,
        suppressions,
    }: {
        behind: readonly ToolVersion[];
        declaration: Declaration | null;
        floors: ReadonlySet<string>;
        off: readonly string[];
        optOuts: readonly OptOut[];
        suppressions: number;
    },
): string[] {
    const { heldOf, others } = baselineReader(root, floors);

    return [
        ...rowsAligned([
            ...declaredOf(declaration),
            ['rules off vs profile', rulesOffOf(off)],
            ...(optOuts.length === 0
                ? []
                : [
                      [
                          'laws set aside',
                          `${String(optOuts.length)} (${optOuts.map(({ law }) => law).join(', ')})`,
                      ] satisfies Row,
                  ]),
            ['suppressions', suppressions],
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
        const { declaration, optOuts } = resolved;
        const off = offOf(objectOf(resolved.sections.typescript).oxlint);
        const suppressions = orRefused(() => countSuppressions(root, context.ignorePatterns));
        const behind = toolVersions().filter(({ verdict }) => verdict !== 'ok');
        const floors = new Set(resolved.floors);
        const { others, totalOf } = baselineReader(root, floors);
        const totals = (kept: (section: string) => boolean): Record<string, unknown> =>
            Object.fromEntries(
                others
                    .filter((section) => kept(section))
                    .map((section) => [section, totalOf(section)]),
            );

        return {
            json: {
                baseline: totalOf(SECTION),
                declaration,
                floors: totals((section) => floors.has(section)),
                optOuts,
                oxlintSuppressions: suppressedCount(root),
                rulesOff: off,
                suppressions,
                sections: totals((section) => !floors.has(section)),
                tools: behind,
            },
            lines: rowsOf(root, { behind, declaration, floors, off, optOuts, suppressions }),
        };
    },
});
