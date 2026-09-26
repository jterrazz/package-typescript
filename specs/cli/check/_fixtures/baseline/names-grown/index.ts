import { LIMIT } from './src/constants.js';
import type { Total } from './src/types.js';

export function run(total: Total): string {
    debugger;
    return `${total} of ${LIMIT}`;
}
