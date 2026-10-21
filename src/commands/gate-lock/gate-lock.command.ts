import process from 'node:process';

import { badge, GREEN, print, RED, RESET } from '../terminal.js';
import { GATE_LOCK, holderOf, refusedWhileGated } from './lock.js';

export function gateLock(): number {
    const project = process.cwd();
    const refused = refusedWhileGated(project, 'an install or a pack');
    if (refused !== undefined) {
        print(`${RED}${refused}${RESET}\n`);

        return 1;
    }
    const holder = holderOf(project);
    print(
        `${badge('TYPESCRIPT')} ${GREEN}${holder === undefined ? `No gate holds this checkout (${GATE_LOCK})` : `This checkout is held by pid ${String(holder)}, the gate this process is a step of`}${RESET}\n`,
    );

    return 0;
}
