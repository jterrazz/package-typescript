import { join } from 'node:path';

import type { Teaching } from '../../kit/catalogue/lesson.js';
import type { Context } from '../../kit/checker/pass.js';
import { logicIn, STANDARD_FOLDER } from '../../kit/project/standard-logic.js';

const STANDARD_MODULE = /(?<!\.test)\.ts$/u;

function standardModules(context: Context, folder: string): string[] {
    return (context.list(join(context.root, folder)) ?? []).toSorted().flatMap((name) => {
        const path = `${folder}/${name}`;

        return STANDARD_MODULE.test(name) ? [path] : standardModules(context, path);
    });
}

/** What each module of a unit's standard computes, where it computes it. */
export function standardLogic(
    context: Context,
    unit: string,
): { path: string; teaching: Teaching }[] {
    const folder = unit === '.' ? STANDARD_FOLDER : `${unit}/${STANDARD_FOLDER}`;

    return standardModules(context, folder).flatMap((path) =>
        logicIn(path, context.read(join(context.root, path)) ?? '').map(({ line, what }) => ({
            path,
            teaching: {
                fix: `state the value it computes, and move the code that applies the standard out of ${STANDARD_FOLDER}/`,
                found: `${path}:${String(line)} holds ${what}`,
            },
        })),
    );
}
