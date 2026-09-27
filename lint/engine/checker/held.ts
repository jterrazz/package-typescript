import { countsOf } from '../baseline/counts.js';
import { judge, LABEL, reRecord, sectionOf } from '../baseline/section.js';
import type { Counts } from '../baseline/section.js';
import type { Context, Finding, Pass, PassResult } from './pass.js';

type Print = (lines: string[]) => void;

export type HeldRun = {
    context: Context;
    findings: Finding[];
    name: string;
    pass: Pass;
    print: Print;
    result: PassResult;
};

function recordedOf(
    root: string,
    namespace: string,
    fix: boolean,
): { recorded: Counts; reRecorded: (counts: Counts, print: Print) => Counts } {
    const owns = (rule: string): boolean => rule.startsWith(namespace);
    const owned = (section: Counts): Counts =>
        Object.fromEntries(Object.entries(section).filter(([rule]) => owns(rule)));
    const recorded = owned(sectionOf(root) ?? {});

    return {
        recorded,
        reRecorded: (counts, print) => {
            if (!fix || Object.keys(recorded).length === 0) {
                return recorded;
            }
            const { lines, section } = reRecord(root, counts, owns);
            print(lines);

            return owned(section);
        },
    };
}

function judgeOneEntry(
    { context, findings, pass, print, result }: HeldRun,
    namespace: string,
): number {
    const entry = pass.entry ?? '';
    const count = findings.length;
    const counts = count > 0 ? { [entry]: count } : {};
    const recorded = recordedOf(context.root, namespace, context.fix).reRecorded(counts, print);
    const stray = judge(counts, recorded).filter(({ rule }) => rule !== entry);
    const held = count === (recorded[entry] ?? 0);
    if (!held) {
        print([`${entry}  ${LABEL}  ${pass.verdict?.(count, recorded[entry], result) ?? ''}`]);
    }
    print(stray.map(({ refusal }) => `baseline-ratchet  ${LABEL}  ${refusal}`));

    return held && stray.length === 0 ? 0 : 1;
}

// Where the baseline records no entry of the pass, every finding is a failure.
export function judgeHeld(run: HeldRun): number {
    const namespace = `${run.name}/`;
    if (run.pass.entry !== undefined) {
        return judgeOneEntry(run, namespace);
    }

    const { context, findings, print } = run;
    const counts = countsOf(findings);
    const { recorded: before, reRecorded } = recordedOf(context.root, namespace, context.fix);
    if (Object.keys(before).length === 0) {
        return findings.length > 0 ? 1 : 0;
    }
    const broken = judge(counts, reRecorded(counts, print));
    print(broken.map(({ refusal }) => `baseline-ratchet  ${LABEL}  ${refusal}`));

    return broken.length > 0 ? 1 : 0;
}
