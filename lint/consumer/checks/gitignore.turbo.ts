import { join } from 'node:path';

import type { Context } from '../../kit/checker/pass.js';
import { ARTIFACTS } from '../../kit/project/build-plan.js';
import { parsedObject } from '../../kit/project/json.js';

export type Judged = { lines: string[]; writes: { path: string; text: string }[] };

const TURBO_CACHE = `${ARTIFACTS}/turbo`;

type TurboCache = { found: string; path: string; text: string };

export function misplacedTurboCache(context: Context): null | TurboCache {
    const path = join(context.root, 'turbo.json');
    const written = context.read(path);
    if (written === null) {
        return null;
    }
    let config: Readonly<Record<string, unknown>>;
    try {
        config = parsedObject(written);
    } catch {
        return null;
    }
    const { cacheDir } = config;
    if (
        typeof cacheDir === 'string' &&
        cacheDir.replace(/^\.\//u, '').replace(/\/$/u, '') === TURBO_CACHE
    ) {
        return null;
    }

    return {
        found: typeof cacheDir === 'string' ? cacheDir : '.turbo/cache, its default',
        path,
        text: `${JSON.stringify({ ...config, cacheDir: TURBO_CACHE }, null, 4)}\n`,
    };
}

export const MISPLACED = 'Artefacts belong under .artifacts/<tool>/ at the project root:';

export function turboJudged(turbo: null | TurboCache, fix: boolean, headed: boolean): Judged {
    if (turbo === null) {
        return { lines: [], writes: [] };
    }

    return fix
        ? {
              lines: [`turbo.json rewritten: cacheDir ${TURBO_CACHE}`],
              writes: [{ path: turbo.path, text: turbo.text }],
          }
        : {
              lines: [
                  ...(headed ? [] : [MISPLACED]),
                  `  ✗ turbo.json caches in ${turbo.found}; its home is ${TURBO_CACHE}/, set as its cacheDir`,
                  "Run 'typescript fix' to set it.",
              ],
              writes: [],
          };
}
