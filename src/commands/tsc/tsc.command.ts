import process from 'node:process';

import { tscHandedOver } from '../../drivers/tsc/tsc.js';

export async function tsc(args: readonly string[]): Promise<number> {
    return await tscHandedOver(args, process.cwd());
}
