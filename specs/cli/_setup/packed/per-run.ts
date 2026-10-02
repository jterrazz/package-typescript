import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHECKOUT = resolve(import.meta.dirname, '../../../..');

/** Packs the checkout once per run and unpacks the tarball as an install lays it, its dependencies resolved from the checkout's own install beside it; every spec and every child it spawns finds it at `PACKED_PACKAGE`. */
export default function setup(): () => void {
    const into = mkdtempSync('/tmp/typescript-packed-');
    const report = execFileSync(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', into],
        { cwd: CHECKOUT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: npm 12 prints one report per package, keyed by name, each with the `filename` this reads
    const packed = JSON.parse(report) as Record<string, { filename: string }>;
    for (const { filename } of Object.values(packed)) {
        execFileSync('tar', ['-xzf', join(into, filename), '-C', into]);
    }
    symlinkSync(join(CHECKOUT, 'node_modules'), join(into, 'package', 'node_modules'), 'dir');
    const previous = process.env.PACKED_PACKAGE;
    process.env.PACKED_PACKAGE = join(into, 'package');

    return () => {
        if (previous === undefined) {
            delete process.env.PACKED_PACKAGE;
        } else {
            process.env.PACKED_PACKAGE = previous;
        }
        rmSync(into, { force: true, recursive: true });
    };
}
