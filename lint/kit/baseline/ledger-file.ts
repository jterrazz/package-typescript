import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export function removeLedger(path: string): void {
    rmSync(path, { force: true });
    if (existsSync(dirname(path)) && readdirSync(dirname(path)).length === 0) {
        rmSync(dirname(path), { recursive: true });
    }
}
