import type { Unread } from '../catalogue/lesson.js';
import { labelOf, sectionOf, writeSection } from './baseline-file.js';
import type { Counts } from './baseline-file.js';

export type Broken = { rule: string; teaching: Unread };

export type Ratchet = { lower: string; record: string };

const byKey = ([left]: [string, number], [right]: [string, number]): number =>
    // Stryker disable next-line EqualityOperator: two entries never share a key, so `<=` orders them as `<` does
    left < right ? -1 : 1;

// invariant: the section is exact: a count above OR below its entry fails, and only the recording gesture raises one.
export function judgeExact(counts: Counts, recorded: Counts, ratchet: Ratchet): Broken[] {
    const broken: Broken[] = [];
    const record = `fix the findings, or run '${ratchet.record}' to record where the project stands`;

    for (const [rule, count] of Object.entries(counts).toSorted(byKey)) {
        const allowed = recorded[rule];
        if (allowed === undefined) {
            broken.push({
                teaching: {
                    fix: record,
                    found: `\`${rule}\` has ${String(count)} finding(s) and no entry records them`,
                    why: 'the section holds the debt the project recorded, and a finding no entry holds is new debt',
                },
                rule,
            });
        } else if (count > allowed) {
            broken.push({
                teaching: {
                    fix: record,
                    found: `\`${rule}\` is at ${String(count)}, above its baseline of ${String(allowed)}`,
                    why: 'each count is held exactly, and a count above its entry is a regression',
                },
                rule,
            });
        } else if (count < allowed) {
            broken.push({
                teaching: {
                    fix: `run '${ratchet.lower}', which re-records the fall`,
                    found: `\`${rule}\` is at ${String(count)}, below its baseline of ${String(allowed)}`,
                    why: 'each count is held exactly, so a debt that fell is recorded the day it falls and cannot grow back unseen',
                },
                rule,
            });
        }
    }

    for (const rule of Object.keys(recorded).toSorted()) {
        if ((counts[rule] ?? 0) === 0) {
            broken.push({
                teaching: {
                    fix: `run '${ratchet.lower}', which deletes the entry`,
                    found: `\`${rule}\` is at zero, and its entry is still recorded`,
                    why: 'an entry with nothing left to hold would let the debt grow back to its old count unseen',
                },
                rule,
            });
        }
    }

    return broken;
}

// invariant: lowers what fell and drops zeros, never raises nor adds a key: debt that grew is the recording gesture's to write.
export function tightened(
    counts: Counts,
    recorded: Counts,
    owns: (rule: string) => boolean,
): Counts | undefined {
    const next: Counts = {};
    let fell = false;
    for (const [rule, allowed] of Object.entries(recorded)) {
        const count = owns(rule) ? Math.min(counts[rule] ?? 0, allowed) : allowed;
        fell ||= count < allowed;
        if (count > 0) {
            next[rule] = count;
        }
    }

    return fell ? next : undefined;
}

export function reRecord(
    root: string,
    { counts, owns, section }: { counts: Counts; owns: (rule: string) => boolean; section: string },
): { lines: string[]; section: Counts } {
    const held = sectionOf(root, section) ?? {};
    const next = tightened(counts, held, owns);
    if (next === undefined) {
        return { lines: [], section: held };
    }

    writeSection(root, section, next);
    const lines = Object.keys(held)
        .toSorted()
        .filter((rule) => (next[rule] ?? 0) !== held[rule])
        .map(
            (rule) =>
                `re-recorded ${labelOf(section)} › ${rule} ${String(held[rule] ?? 0)} → ${String(next[rule] ?? 0)}`,
        );

    return { lines, section: next };
}
