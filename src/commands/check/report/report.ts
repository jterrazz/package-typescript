import { readFileSync } from 'node:fs';

import type { Logs } from './logs.js';
import { badge, GREEN, print, RED, RESET, secondsOf } from './terminal.js';

export function reportPass(
    logs: Logs,
    {
        label,
        log,
        seconds,
        status,
        writes = false,
    }: { label: string; log: string; seconds: number; status: number; writes?: boolean },
): void {
    print(`\n${badge('RUN')} ${label}\n\n`);
    if ((status !== 0 || writes) && logs.holds(log)) {
        print(readFileSync(log));
    }
    print(
        status === 0
            ? `${GREEN}✓ Passed (${secondsOf(seconds)})${RESET}\n`
            : `${RED}✗ Failed with exit code ${String(status)} (${secondsOf(seconds)})${RESET}\n`,
    );
}
