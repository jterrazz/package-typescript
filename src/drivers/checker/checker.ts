import { createRequire } from 'node:module';
import process from 'node:process';

import type { PresetChecker } from '../../../lint/kit/project/preset.js';
import { handOver, run } from '../run.js';
import type { Stream } from '../run.js';

const TYPELESS_WARNING = '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON';

const checkerProgram = (): string => createRequire(import.meta.url).resolve('#checker');

export async function checker(
    pass: string,
    args: readonly string[],
    stdout: Stream,
    {
        stderr = 'stdout',
        typeless = false,
    }: { stderr?: 'stdout' | Stream; typeless?: boolean } = {},
): Promise<number> {
    return await run(
        process.execPath,
        [...(typeless ? [TYPELESS_WARNING] : []), checkerProgram(), pass, ...args],
        { stderr, stdout },
    );
}

/** Runs the checks a preset brings, its module handed to the checker program. */
export async function presetChecker(
    { module }: PresetChecker,
    args: readonly string[],
    stdout: Stream,
): Promise<number> {
    return await run(process.execPath, [checkerProgram(), '--preset', module, ...args], {
        stderr: 'stdout',
        stdout,
    });
}

/** Hands the terminal to one pass of the checker program, as the kit's own commands run. */
export async function checkerHandedOver(args: readonly string[]): Promise<number> {
    return await handOver(process.execPath, [checkerProgram(), ...args]);
}
