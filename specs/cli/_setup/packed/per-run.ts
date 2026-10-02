import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import {
    CHECKOUT,
    linkBins,
    linkFromCheckout,
    readManifest,
    runtimeDependencies,
} from './closure.ts';

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
    const unpacked = join(into, 'package');
    const modules = join(unpacked, 'node_modules');
    for (const name of runtimeDependencies(readManifest(unpacked))) {
        if (existsSync(join(CHECKOUT, 'node_modules', name))) {
            linkFromCheckout(name, modules);
            linkBins(join(modules, name), modules);
        }
    }
    const previous = process.env.PACKED_PACKAGE;
    process.env.PACKED_PACKAGE = unpacked;

    return () => {
        if (previous === undefined) {
            delete process.env.PACKED_PACKAGE;
        } else {
            process.env.PACKED_PACKAGE = previous;
        }
        rmSync(into, { force: true, recursive: true });
    };
}
