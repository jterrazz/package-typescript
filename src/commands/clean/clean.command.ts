import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { ARTIFACTS } from '../../../lint/kit/project/build-plan.js';
import { badge, GREEN, print, RESET } from '../terminal.js';

export function clean(): number {
    const artefacts = join(process.cwd(), ARTIFACTS);
    print(`${badge('TYPESCRIPT')} Removing artefacts...\n\n`);
    if (existsSync(artefacts)) {
        rmSync(artefacts, { recursive: true });
        print(`${GREEN}Removed ${ARTIFACTS}/${RESET}\n`);
    } else {
        print(`${GREEN}Nothing to remove: ${ARTIFACTS}/ is already absent${RESET}\n`);
    }

    return 0;
}
