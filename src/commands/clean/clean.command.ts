import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { badge, GREEN, print, RESET } from '../check/report/terminal.js';

export function clean(): number {
    const artefacts = join(process.cwd(), '.artifacts');
    print(`${badge('TYPESCRIPT')} Removing artefacts...\n\n`);
    if (existsSync(artefacts)) {
        rmSync(artefacts, { force: true, recursive: true });
        print(`${GREEN}Removed .artifacts/${RESET}\n`);
    } else {
        print(`${GREEN}Nothing to remove — .artifacts/ is already absent${RESET}\n`);
    }

    return 0;
}
