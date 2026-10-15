import { join } from 'node:path';

import { readBaseline, sectionOf } from '../../kit/baseline/baseline-file.js';
import { suppressedCount } from '../../kit/baseline/oxlint-suppressions.js';
import type { Pass } from '../../kit/checker/pass.js';
import { unmeasuredBrowserMutants } from '../../kit/project/browser-side.js';
import { countStrykerDirectives, countSuppressions } from '../../kit/project/comments.js';
import { exceptionsIn } from '../../kit/project/exceptions.js';
import { objectOf } from '../../kit/project/json.js';
import { orRefused } from '../../kit/project/project-files.js';
import { levelOf, projectOxlintOf } from '../../kit/project/project-oxlint.js';
import { toolVersions } from '../../kit/project/tool-versions.js';
import { workspaceMembers } from '../../kit/project/workspace-members.js';
import { BASELINE_SECTION as SECTION } from '../catalogue/preset.js';
import { driftLines, sum } from './drift.counts.js';

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
        const { heldOf, others, totalOf } = baselineReader(root);

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
            lines: driftLines({
                behind,
                declaration,
                exceptions,
                held: [SECTION, ...others].map((section) => [section, heldOf(section)] as const),
                ledger: suppressedCount(root) ?? 'nothing held',
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
