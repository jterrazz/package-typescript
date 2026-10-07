import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function stubbed(workdir: string, sync: readonly string[]): void {
    const binaries = join(workdir, 'node_modules/.bin');
    mkdirSync(binaries, { recursive: true });
    writeFileSync(
        join(binaries, 'astro'),
        [
            '#!/bin/sh',
            'if [ "$1" = sync ]; then',
            ...sync,
            'fi',
            'echo "astro-check-ran"',
            'exit 0',
            '',
        ].join('\n'),
    );
    chmodSync(join(binaries, 'astro'), 0o755);
}

export function astroStub(workdir: string): void {
    stubbed(workdir, [
        '    echo "astro-synced"',
        '    mkdir -p .astro',
        `    printf '%s\\n' "declare module 'astro:middleware' { export const sequence: () => unknown; }" > .astro/types.d.ts`,
        '    exit 0',
    ]);
}

export function astroStubFailingSync(workdir: string): void {
    stubbed(workdir, ['    echo "astro-sync-failed"', '    exit 1']);
}
