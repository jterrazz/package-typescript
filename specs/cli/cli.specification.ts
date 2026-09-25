import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { SELECTING_BIN } from './check-passes.js';

// The ONE real runner: every spec goes through the product command
// (`typescript build|bundle|dev|start|docs-layout|doctor|baseline|tsc|check|fix|clean`),
// never a tool underneath it — `bin/typescript.sh`, reached through the
// selector, which hands it every run that names no pass.

/*
 * Rolldown's slow-plugin advisory, emitted on stderr when dts generation happens
 * to dominate a build — which it does when the suite runs its builds in parallel
 * and not when a single one runs alone. It is a property of the machine's load,
 * never of the command, so no token can cover it: a document would have to accept
 * any stderr to survive it. D6's escape hatch is the right one here.
 */
const SLOW_PLUGIN_ADVISORY =
    /\[PLUGIN_TIMINGS\][\s\S]*?checks#plugintimings for more details\.\n?/gu;

function withoutSlowPluginAdvisory(text: string): string {
    if (!text.includes('[PLUGIN_TIMINGS]')) {
        return text;
    }
    const remaining = text.replace(SLOW_PLUGIN_ADVISORY, '');
    return remaining.trim() === '' ? '' : remaining;
}

/*
 * Every run may name its passes: the three `passes-*` documents state
 * `TYPESCRIPT_CHECK_PASSES` in their `env:`, which the selector reads.
 */
export const { cli, cleanup } = await specification.cli(SELECTING_BIN, {
    transform: withoutSlowPluginAdvisory,
});

afterAll(cleanup);
