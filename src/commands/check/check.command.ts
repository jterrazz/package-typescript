import { runChecks } from './checks.js';
import type { Selected } from './passes/passes.js';

export async function check(args: readonly string[], selected: Selected): Promise<number> {
    return await runChecks(args, { fix: false, selected });
}
