import process from 'node:process';

import { builtApplication } from '../../drivers/node/node.js';

export async function start(args: readonly string[]): Promise<number> {
    return await builtApplication(args, process.cwd());
}
