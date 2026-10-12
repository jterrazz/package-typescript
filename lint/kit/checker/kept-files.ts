import { join, matchesGlob } from 'node:path';

import { keptByteForByte, verbatimTreesOf } from '../project/byte-for-byte.js';
import { workspaceMembers } from '../project/workspace-members.js';
import type { Context } from './pass.js';

type Configured = Pick<Context, 'config' | 'root'>;

async function perUnit(
    context: Configured,
    globsOf: (typescript: unknown, unitRoot: string) => string[],
): Promise<string[]> {
    const units = ['', ...workspaceMembers(context.root).map((member) => `${member}/`)];
    const found = await Promise.all(
        units.map(async (prefix) => {
            const unitRoot = join(context.root, prefix);
            const { resolved } = await context.config(unitRoot);

            return globsOf(resolved.sections.typescript, unitRoot).map(
                (pattern) => `${prefix}${pattern}`,
            );
        }),
    );

    return found.flat();
}

/** The trees `typescript.roots` declares verbatim, in the root and in every workspace member: what no pass reads or rewrites. */
export const verbatimGlobsOf = async (context: Configured): Promise<string[]> =>
    await perUnit(context, verbatimTreesOf);

/** The files of the tree a pass neither judges nor rewrites: what the formatter keeps byte for byte — a content tree such as assets/, a script's output, a test's ground — in the root and in every workspace member. */
export async function filesKeptByteForByte(context: Context): Promise<(file: string) => boolean> {
    const patterns = await perUnit(context, keptByteForByte);

    return (file) => patterns.some((pattern) => matchesGlob(file, pattern));
}
