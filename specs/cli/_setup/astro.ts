import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function astroStub(workdir: string): void {
    const binaries = join(workdir, 'node_modules/.bin');
    mkdirSync(binaries, { recursive: true });
    writeFileSync(join(binaries, 'astro'), '#!/bin/sh\necho "astro-check-ran"\nexit 0\n');
    chmodSync(join(binaries, 'astro'), 0o755);
}
