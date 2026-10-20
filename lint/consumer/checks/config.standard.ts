import { join } from 'node:path';

import type { Context, Finding } from '../../kit/checker/pass.js';
import { configFinding } from './config.finding.js';

const STANDARD_FOLDER = 'src/standard';

const SCRIPT_MODULE = /(?<!\.test)\.(?:[cm]?[jt]s|[jt]sx)$/u;

function standardModules(context: Context, folder: string): string[] {
    return (context.list(join(context.root, folder)) ?? []).toSorted().flatMap((name) => {
        const path = `${folder}/${name}`;
        if (context.list(join(context.root, path)) !== null) {
            return standardModules(context, path);
        }

        return SCRIPT_MODULE.test(name) ? [path] : [];
    });
}

/** What each module of a unit's standard computes, where it computes it: the compiler loaded only for a unit that keeps one. */
export async function standardLogic(context: Context, unit: string): Promise<Finding[]> {
    const folder = unit === '.' ? STANDARD_FOLDER : `${unit}/${STANDARD_FOLDER}`;
    const found = await Promise.all(
        standardModules(context, folder).map(async (path) => {
            const text = context.read(join(context.root, path));
            if (text === null) {
                return [];
            }
            const { logicIn } = await import('../../kit/project/standard-logic.js');

            return logicIn(path, text).map(({ line, what }) =>
                configFinding('config/standard-is-data', path, {
                    fix: `state the value it computes, and move the code that applies the standard out of ${STANDARD_FOLDER}/`,
                    found: `${path}:${String(line)} holds ${what}`,
                }),
            );
        }),
    );

    return found.flat();
}
