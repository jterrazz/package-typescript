import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

// The ONE real runner: every spec goes through the product command
// (`typescript build|bundle|dev|start|docs|check|fix`), never a tool underneath it.
const BIN = resolve(import.meta.dirname, '../../bin/typescript.sh');

/*
 * Rolldown's slow-plugin advisory, emitted on stderr when dts generation happens
 * to dominate a build — which it does when the suite runs its builds in parallel
 * and not when a single one runs alone. It is a property of the machine's load,
 * never of the command, so no token can cover it: a document would have to accept
 * any stderr to survive it. D6's escape hatch is the right one here.
 */
const SLOW_PLUGIN_ADVISORY = /\[PLUGIN_TIMINGS\][\s\S]*?checks#plugintimings for more details\.\n?/g;

function withoutSlowPluginAdvisory(text: string): string {
    if (!text.includes('[PLUGIN_TIMINGS]')) {
        return text;
    }
    const remaining = text.replace(SLOW_PLUGIN_ADVISORY, '');
    return remaining.trim() === '' ? '' : remaining;
}

export const { cli, cleanup } = await specification.cli(BIN, {
    transform: withoutSlowPluginAdvisory,
});

afterAll(cleanup);
