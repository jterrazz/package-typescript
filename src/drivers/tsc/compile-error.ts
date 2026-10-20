import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { tscBinary } from './tsc.js';

const TSCONFIG = 'tsconfig.json';

const DIAGNOSTIC = /(?:(?<file>.+)\((?<line>\d+),\d+\): )?error (?<code>TS\d+): (?<message>.+)/u;

/** The headline of the first error the compiler finds in the project's unmutated tree, as `file:line TS<code> <message>`, read through its `tsconfig.json` without emitting, as Stryker's TypeScript checker reads it; none where the tree compiles, or keeps no `tsconfig.json`. */
export function firstCompileError(project: string): string | undefined {
    if (!existsSync(join(project, TSCONFIG))) {
        return undefined;
    }
    const run = spawnSync(tscBinary(), ['--noEmit', '--pretty', 'false', '--project', TSCONFIG], {
        cwd: project,
        encoding: 'utf8',
    });
    const first = DIAGNOSTIC.exec(run.stdout)?.groups;
    if (first === undefined) {
        return undefined;
    }
    const { code, file, line, message } = first;

    return file === undefined ? `${code} ${message}` : `${file}:${line} ${code} ${message}`;
}
