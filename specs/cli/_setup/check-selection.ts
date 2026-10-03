#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

import { CHECK_PASSES, main } from '#command';
import type { CheckPass } from '#command';

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

// invariant: a fixture that declares no kind is judged by every pass but the Config pass, whose own specs refuse it: each spec reads the one behaviour it is about.
const undeclared =
    !existsSync('jterrazz.config.ts') ||
    !/\bkind\s*:/u.test(readFileSync('jterrazz.config.ts', 'utf8'));

process.exitCode =
    requested === ''
        ? await main(process.argv.slice(2), {
              selected: (pass) => !undeclared || pass !== 'config',
          })
        : await selectedRun();
