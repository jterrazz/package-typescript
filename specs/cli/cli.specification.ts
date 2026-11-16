import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { SELECTING_BIN } from './__setup__/check-passes.js';
import { ONE_FORM } from './__setup__/oxlint-forms.js';

// outside: Rolldown's slow-plugin advisory depends on the machine's load, never on the command: no token covers it.
const SLOW_PLUGIN_ADVISORY =
    /\[PLUGIN_TIMINGS\][\s\S]*?checks#bundlertimings for more details\.\n?/gu;

function withoutSlowPluginAdvisory(text: string): string {
    if (!text.includes('[PLUGIN_TIMINGS]')) {
        return text;
    }
    const remaining = text.replaceAll(SLOW_PLUGIN_ADVISORY, '');
    return remaining.trim() === '' ? '' : remaining;
}

// outside: publint checks a manifest's entries in a queue of promises and numbers its messages in the order they settle, which the machine's load decides: each numbered block is read in the order of its text.
const PUBLINT_HEADING = /^(?:Errors|Warnings|Suggestions):$/u;
const NUMBERED = /^\d+\. /u;

function withPublintMessagesInOrder(text: string): string {
    const lines = text.split('\n');
    for (const [index, line] of lines.entries()) {
        if (!PUBLINT_HEADING.test(line)) {
            continue;
        }
        const start = index + 1;
        let end = start;
        while (NUMBERED.test(lines[end] ?? '')) {
            end += 1;
        }
        const messages = lines
            .slice(start, end)
            .map((entry) => entry.replace(NUMBERED, ''))
            .toSorted()
            .map((message, position) => `${String(position + 1)}. ${message}`);
        lines.splice(start, messages.length, ...messages);
    }

    return lines.join('\n');
}

export const { cli, cleanup } = await specification.cli(SELECTING_BIN, {
    defaults: ONE_FORM,
    transform: (text) => withPublintMessagesInOrder(withoutSlowPluginAdvisory(text)),
});

afterAll(cleanup);
