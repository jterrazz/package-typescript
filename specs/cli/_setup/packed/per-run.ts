import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unpackedInto } from './pack.ts';

export default function setup(): () => void {
    const into = mkdtempSync(join(tmpdir(), 'typescript-packed-'));
    const previous = process.env.PACKED_PACKAGE;
    process.env.PACKED_PACKAGE = unpackedInto(into);

    return () => {
        if (previous === undefined) {
            delete process.env.PACKED_PACKAGE;
        } else {
            process.env.PACKED_PACKAGE = previous;
        }
        rmSync(into, { force: true, recursive: true });
    };
}
