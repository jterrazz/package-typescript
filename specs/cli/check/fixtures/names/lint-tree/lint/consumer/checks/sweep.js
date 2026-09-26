import { argv, exit } from 'node:process';

export const sweep = argv.length;

if (import.meta.main) {
    exit(sweep > 2 ? 1 : 0);
}
