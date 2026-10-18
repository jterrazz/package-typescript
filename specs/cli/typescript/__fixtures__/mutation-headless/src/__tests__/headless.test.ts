import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

// invariant: the module run runs only the tests related to the source it mutates, so this test imports it to be run.
import '../discount.js';

// invariant: the child only reads the first folder on its PATH, and never runs an opener, so a run that failed to lay the refusing ones fails this test and opens nothing.
const SEEN = `
const { readFileSync } = require('node:fs');
const { delimiter, join } = require('node:path');
const first = process.env.PATH.split(delimiter)[0];
const refuses = (name) => readFileSync(join(first, name), 'utf8').includes('a check may not open a browser');
process.stdout.write(JSON.stringify({ browser: process.env.BROWSER, open: refuses('open'), xdgOpen: refuses('xdg-open') }));
`;

test('a process a test starts finds a refusing opener first on its PATH, and no browser to hand a URL to', () => {
    const seen: unknown = JSON.parse(
        execFileSync(process.execPath, ['--input-type=commonjs', '--eval', SEEN], {
            encoding: 'utf8',
        }),
    );

    expect(seen).toStrictEqual({ browser: 'none', open: true, xdgOpen: true });
});
