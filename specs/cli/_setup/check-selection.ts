#!/usr/bin/env node
import process from 'node:process';

import { CHECK_PASSES, main } from '../../../dist/command.js';
import type { CheckPass } from '../../../dist/command.js';

// The published package holds no copy of this selector: the command runs every pass unless its caller hands it a selection.

const requested = process.env.TYPESCRIPT_CHECK_PASSES ?? '';

function isPass(name: string): name is CheckPass {
    return (CHECK_PASSES as readonly string[]).includes(name);
}

async function selectedRun(): Promise<number> {
    const passes = requested.split(',');
    const unknown = passes.find((pass) => !isPass(pass));
    if (unknown !== undefined) {
        process.stderr.write(
            `TYPESCRIPT_CHECK_PASSES names no pass: ${unknown} — the passes are ${CHECK_PASSES.join(',')}\n`,
        );

        return 2;
    }

    return await main(process.argv.slice(2), { selected: (pass) => passes.includes(pass) });
}

process.exitCode = requested === '' ? await main(process.argv.slice(2)) : await selectedRun();
