import { judge, LABEL, readBaseline, reRecord } from '../baseline/ratchet.js';

function countsOf(findings) {
    const counts = {};
    for (const { rule } of findings) {
        counts[rule] = (counts[rule] ?? 0) + 1;
    }

    return counts;
}

function recordedOf(root, namespace, fix) {
    const owns = (rule) => rule.startsWith(namespace);
    const owned = (section) =>
        Object.fromEntries(Object.entries(section).filter(([rule]) => owns(rule)));
    const recorded = owned(readBaseline(root) ?? {});

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

function judgeOneEntry({ context, findings, pass, print, result }, namespace) {
    const { entry } = pass;
    const count = findings.length;
    const counts = count > 0 ? { [entry]: count } : {};
    const recorded = recordedOf(context.root, namespace, context.fix).reRecorded(counts, print);
    const stray = judge(counts, recorded).filter((reason) => !reason.startsWith(`${entry} `));
    const held = count === (recorded[entry] ?? 0);
    if (!held) {
        print([`${entry}  ${LABEL}  ${pass.verdict(count, recorded[entry], result)}`]);
    }
    print(stray.map((reason) => `baseline-ratchet  ${LABEL}  ${reason}`));

    return held && stray.length === 0 ? 0 : 1;
}

// Where the baseline records no entry of the pass, every finding is a failure.
export function judgeHeld(run) {
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
    print(broken.map((reason) => `baseline-ratchet  ${LABEL}  ${reason}`));
    if (broken.length > 0) {
        print(["Run 'typescript baseline' to record where the project actually stands."]);
    }

    return broken.length > 0 ? 1 : 0;
}
