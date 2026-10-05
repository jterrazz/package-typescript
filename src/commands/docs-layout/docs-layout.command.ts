import process from 'node:process';

import { checkerHandedOver } from '../../drivers/checker/checker.js';

export async function docsLayout([root]: readonly string[]): Promise<number> {
    return await checkerHandedOver([
        'docs',
        root === undefined || root === '' ? process.cwd() : root,
    ]);
}
