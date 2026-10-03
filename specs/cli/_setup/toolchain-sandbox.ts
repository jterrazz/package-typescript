import { cpSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { temporaryDirectory } from '../../_shared/_setup/temporary-directory.js';

// hazard: a copy, not a link: Node resolves a symlinked script back to the checkout it points at.

const REPOSITORY = resolve(import.meta.dirname, '../../..');

// invariant: a version writes a manifest claiming it; `null` leaves the tool out.
export function toolchainWith(tools: Record<string, null | string>): string {
    const root = temporaryDirectory('spec-toolchain-');

    const packed = process.env.PACKED_PACKAGE ?? '';
    cpSync(packed, root, {
        filter: (source) => source !== join(packed, 'node_modules'),
        recursive: true,
    });

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
