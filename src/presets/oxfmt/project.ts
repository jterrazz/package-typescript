import { join } from 'node:path';
import type { OxfmtConfig } from 'oxfmt';

import { readSettings } from '../../../lint/index.rules.js';
import { keptByteForByte } from '../../../lint/kit/project/byte-for-byte.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';
import style from './style.js';

// invariant: a workspace root formats the whole repository, so what each member keeps as written is kept as written from the root too, under the member's folder.
async function keptBy(unit: string): Promise<string[]> {
    const { resolved } = await readSettings(unit);
    const members = await Promise.all(
        workspaceMembers(unit).map(async (member) => {
            const { resolved: own } = await readSettings(join(unit, member));

            return keptByteForByte(own.sections.typescript).map(
                (pattern) => `${member}/${pattern}`,
            );
        }),
    );

    return [...keptByteForByte(resolved.sections.typescript), ...members.flat()];
}

export async function oxfmtConfigAt(unit: string): Promise<OxfmtConfig> {
    return { ...style, ignorePatterns: await keptBy(unit) };
}
