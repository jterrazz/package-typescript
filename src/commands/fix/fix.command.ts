import { runChecks } from '../check/checks.js';
import type { Selected } from '../check/passes/passes.js';

export async function fix(args: readonly string[], selected: Selected): Promise<number> {
    return await runChecks(args, { fix: true, selected });
}
