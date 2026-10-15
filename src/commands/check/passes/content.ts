import { readSettings } from '../../../../lint/index.rules.js';

/** Whether the working directory declares itself `content`: a repository with no code, which only the content passes judge. */
// Stryker disable next-line StringLiteral: the root and an empty name resolve to the working directory alike
export async function holdsContentOnly(unit = '.'): Promise<boolean> {
    const { resolved } = await readSettings(unit);

    return resolved.declaration?.kind === 'content';
}
