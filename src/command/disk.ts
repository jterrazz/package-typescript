import { statSync } from 'node:fs';

export function isFile(path: string): boolean {
    return statSync(path, { throwIfNoEntry: false })?.isFile() === true;
}
