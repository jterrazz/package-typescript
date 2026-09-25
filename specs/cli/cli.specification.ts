import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { SELECTING_BIN } from './check-passes.js';

// Rolldown's slow-plugin advisory depends on the machine's load, never on the command: no token covers it.
const SLOW_PLUGIN_ADVISORY =
    /\[PLUGIN_TIMINGS\][\s\S]*?checks#plugintimings for more details\.\n?/gu;

function withoutSlowPluginAdvisory(text: string): string {
    if (!text.includes('[PLUGIN_TIMINGS]')) {
        return text;
    }
    const remaining = text.replace(SLOW_PLUGIN_ADVISORY, '');
    return remaining.trim() === '' ? '' : remaining;
}

export const { cli, cleanup } = await specification.cli(SELECTING_BIN, {
    transform: withoutSlowPluginAdvisory,
});

afterAll(cleanup);
