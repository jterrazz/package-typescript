import process from 'node:process';

import { run } from './processes.js';
import type { Stream } from './processes.js';
import { checkerProgram } from './toolchain.js';

const TYPELESS_WARNING = '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON';

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
