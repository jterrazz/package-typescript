import { mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { APART_VARIABLE, apartIn, heldApart } from '../priced-apart.js';

function folder(): string {
    const fresh = mkdtempSync(join(tmpdir(), 'priced-apart-'));
    const made = realpathSync(fresh);
    onTestFinished(() => {
        rmSync(made, { force: true, recursive: true });
    });

    return made;
}

describe('priced-apart', () => {
    test('heldApart — a process registers in the folder a stage names while it runs, and takes it back; none where no stage names one, or the folder no longer stands', () => {
        // Given - a stage's folder, a process registered there, one registered under no stage, one under a folder already removed, and one whose stage removed its folder before it let go
        const stage = folder();
        const release = heldApart(41, { [APART_VARIABLE]: stage });
        const held = apartIn(stage);
        release();
        const unnamed = heldApart(42, {});
        const gone = join(stage, 'removed');
        heldApart(43, { [APART_VARIABLE]: gone })();
        unnamed();
        const orphan = folder();
        const late = heldApart(44, { [APART_VARIABLE]: orphan });
        rmSync(orphan, { recursive: true });
        late();

        // Then - the pid is held apart until released, nothing is written elsewhere, a folder that does not stand holds none, and letting go after the folder went threw nothing
        expect([
            [...held],
            [...apartIn(stage)],
            readdirSync(stage),
            [...apartIn(gone)],
        ]).toStrictEqual([[41], [], [], []]);
    });

    test('apartIn — the pids a folder holds, a name that is no pid left out', () => {
        // Given - a folder holding two pids and a stray name
        const stage = folder();
        for (const name of ['7', '12', 'stray']) {
            writeFileSync(join(stage, name), '');
        }

        // Then - the two pids
        expect([...apartIn(stage)].toSorted((a, b) => a - b)).toStrictEqual([7, 12]);
    });
});
