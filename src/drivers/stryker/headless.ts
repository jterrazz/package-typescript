import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const REFUSING_OPENER_SOURCE = `#!/bin/sh
printf 'a check may not open a browser: %s %s\\n' "\${0##*/}" "$*" >&2
exit 1
`;

const OPENERS = ['open', 'xdg-open'];

export type HeadlessEnvironment = { BROWSER: string; PATH: string };

// invariant: no check may open a window. Every process a stage's Stryker starts inherits this environment, a spec's spawned CLI included: `open` and `xdg-open` refuse first on PATH (the `open` package spawns the first on macOS), and BROWSER=none leaves the bundled xdg-open Linux uses no browser to hand a URL to.
/** Lays the refusing openers in `folder`, and returns the environment that puts them first. */
export function headlessEnvironment(folder: string, path: string | undefined): HeadlessEnvironment {
    mkdirSync(folder, { recursive: true });
    for (const name of OPENERS) {
        const opener = join(folder, name);
        writeFileSync(opener, REFUSING_OPENER_SOURCE);
        chmodSync(opener, 0o755);
    }

    return { BROWSER: 'none', PATH: `${folder}${delimiter}${path ?? ''}` };
}
