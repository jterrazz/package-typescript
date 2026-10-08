import { join, matchesGlob } from 'node:path';

import { keptByteForByte } from '../project/byte-for-byte.js';
import { workspaceMembers } from '../project/workspace-members.js';
import type { Context } from './pass.js';

/** The files of the tree a pass neither judges nor rewrites: what the formatter keeps byte for byte — a content tree such as assets/, a script's output, a test's ground — in the root and in every workspace member. */
export async function filesKeptByteForByte(context: Context): Promise<(file: string) => boolean> {
    const units = ['', ...workspaceMembers(context.root).map((member) => `${member}/`)];
    const kept = await Promise.all(
        units.map(async (prefix) => {
            const { resolved } = await context.config(join(context.root, prefix));

            return keptByteForByte(resolved.sections.typescript).map(
                (pattern) => `${prefix}${pattern}`,
            );
        }),
    );
    const patterns = kept.flat();

    return (file) => patterns.some((pattern) => matchesGlob(file, pattern));
}
