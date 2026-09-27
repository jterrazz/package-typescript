import { statSync } from 'node:fs';

export function isFile(path: string): boolean {
    return statSync(path, { throwIfNoEntry: false })?.isFile() === true;
}

export function isDirectory(path: string): boolean {
    return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}
