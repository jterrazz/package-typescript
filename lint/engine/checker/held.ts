import { BASELINE, labelOf, sectionOf } from '../baseline/baseline-file.js';
import type { Counts } from '../baseline/baseline-file.js';
import { countsOf } from '../baseline/counts.js';
import { judgeExact, reRecord } from '../baseline/section.js';
import type { Broken } from '../baseline/section.js';
import { refusalReading } from '../catalogue/lesson.js';
import type { Context, Finding, Held, HeldSection, Pass, PassResult } from './pass.js';
import { reportLine } from './report-line.js';

export const isHeldBy = (passes: readonly string[], rule: string): boolean =>
    passes.some((pass) => rule.startsWith(`${pass}/`));

type Print = (lines: string[]) => void;

export type HeldRun = {
    context: Context;
    findings: Finding[];
    held: Held;
    name: string;
    pass: Pass;
    print: Print;
    result: PassResult;
};

const ratchetLine = (held: HeldSection, { teaching }: Broken): string =>
    `baseline-ratchet  ${labelOf(held.section)}  ${refusalReading(held.read, teaching)}`;

function recordedOf(
    { held, namespace, root }: { held: HeldSection; namespace: string; root: string },
    fix: boolean,
): { recorded: Counts; reRecorded: (counts: Counts, print: Print) => Counts } {
    const owns = (rule: string): boolean => rule.startsWith(namespace);
    const owned = (section: Counts): Counts =>
        Object.fromEntries(Object.entries(section).filter(([rule]) => owns(rule)));
    const recorded = owned(sectionOf(root, held.section) ?? {});

    return {
        recorded,
        reRecorded: (counts, print) => {
            if (!fix || Object.keys(recorded).length === 0) {
                return recorded;
            }
            const { lines, section } = reRecord(root, { counts, owns, section: held.section });
            print(lines);

            return owned(section);
        },
    };
}

export function heldSummary(root: string, section: string): string {
    const entries = Object.values(sectionOf(root, section) ?? {}).filter((count) => count > 0);
    const total = entries.reduce((sum, count) => sum + count, 0);

    return entries.length === 0
        ? `${labelOf(section)}: nothing held`
        : `${labelOf(section)}: ${String(total)} held across ${String(entries.length)} rule${entries.length === 1 ? '' : 's'}`;
}

function judgeOneEntry(run: HeldRun, namespace: string): number {
    const { context, findings, held, pass, print, result } = run;
    const entry = pass.entry ?? '';
    const count = findings.length;
    const counts = count > 0 ? { [entry]: count } : {};
    const recorded = recordedOf({ held, namespace, root: context.root }, context.fix).reRecorded(
        counts,
        print,
    );
    const stray = judgeExact(counts, recorded, held).filter(({ rule }) => rule !== entry);
    const kept = count === (recorded[entry] ?? 0);
    if (!kept) {
        print([
            `${entry}  ${labelOf(held.section)}  ${pass.verdict?.(count, recorded[entry], result) ?? ''}`,
        ]);
    }
    print(stray.map((broken) => ratchetLine(held, broken)));

    return kept && stray.length === 0 ? 0 : 1;
}

const unrecorded = (held: HeldSection, namespace: string): string =>
    refusalReading(held.read, {
        fix: `fix them, or run '${held.record}' to record where the project stands`,
        found: `every finding above, and ${BASELINE} records no \`${namespace}\` entry in its \`${held.section}\` section to hold one`,
        why: 'a project that recorded no debt is held at zero, so each finding fails the run as new debt',
    });

function judgeEntries(run: HeldRun, namespace: string): number {
    const { context, findings, held, print } = run;
    const counts = countsOf(findings);
    const { recorded: before, reRecorded } = recordedOf(
        { held, namespace, root: context.root },
        context.fix,
    );
    const broken =
        Object.keys(before).length === 0
            ? findings.length > 0
                ? [unrecorded(held, namespace)]
                : []
            : judgeExact(counts, reRecorded(counts, print), held).map((one) =>
                  ratchetLine(held, one),
              );
    if (broken.length > 0) {
        print([...findings.map((finding) => reportLine(finding)), ...broken]);
    }

    return broken.length > 0 ? 1 : 0;
}

// Where the baseline records no entry of the pass, every finding is a failure.
export function judgeHeld(run: HeldRun): number {
    const namespace = `${run.pass.namespace ?? run.name}/`;
    const status =
        run.pass.entry === undefined ? judgeEntries(run, namespace) : judgeOneEntry(run, namespace);
    if (status === 0 && run.held.summarised === true) {
        run.print([heldSummary(run.context.root, run.held.section)]);
    }

    return status;
}
