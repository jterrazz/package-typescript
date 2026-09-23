import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { onTestFinished } from 'vitest';

/*
 * What the version-reading specs stand on: a copy of this package whose
 * `node_modules` is this checkout's, entry for entry, except for the tools a
 * case says otherwise about. The product reads every version off an INSTALLED
 * manifest beside its own code, so the only way to make one deviate is to put
 * the package beside a different install — a copy, since Node resolves a
 * symlinked script back to the checkout it points at.
 */

const REPOSITORY = resolve(import.meta.dirname, '../..');

/**
 * The package, copied into a temp directory, with `tools` overriding what is
 * installed: a version writes a manifest claiming it, `null` leaves the tool
 * out. Returns the sandbox's root; its `bin/typescript.sh` is the product.
 */
export function toolchainWith(tools: Record<string, null | string>): string {
    const root = mkdtempSync(resolve(tmpdir(), 'spec-toolchain-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });

    for (const entry of ['bin', 'lint', 'src', 'package.json']) {
        cpSync(join(REPOSITORY, entry), join(root, entry), { recursive: true });
    }

    const installed = join(root, 'node_modules');
    mkdirSync(installed);
    for (const name of readdirSync(join(REPOSITORY, 'node_modules'))) {
        if (!Object.hasOwn(tools, name)) {
            symlinkSync(join(REPOSITORY, 'node_modules', name), join(installed, name));
        }
    }
    for (const [name, version] of Object.entries(tools)) {
        if (version !== null) {
            mkdirSync(join(installed, name));
            writeFileSync(
                join(installed, name, 'package.json'),
                `${JSON.stringify({ name, version })}\n`,
            );
        }
    }

    return root;
}
