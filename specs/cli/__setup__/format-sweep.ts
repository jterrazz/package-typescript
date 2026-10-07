import type { PrepareStep } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cli } from '../cli.specification.js';
import { onlyPasses } from './check-passes.js';
import { repository } from './repository.js';

export const MISFORMATTED = 'export const shape = {wide:1}\n';

export const FORMATTED = 'export const shape = { wide: 1 };\n';

/** The repository indexes the fixture; then a misformatted file its .gitignore keeps out, and a source file no `git add` reached. */
export function sweptRepository(newSource: string): PrepareStep {
    return (workdir) => {
        mkdirSync(join(workdir, 'local'));
        writeFileSync(join(workdir, 'local/scratch.ts'), MISFORMATTED);
        repository(workdir);
        writeFileSync(join(workdir, 'src/added.ts'), newSource);
    };
}

export const formatter = cli.with({ env: onlyPasses('oxfmt') });
