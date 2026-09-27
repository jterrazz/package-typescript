import { statSync } from 'node:fs';

export function isFileOnDisk(path: string): boolean {
    return statSync(path, { throwIfNoEntry: false })?.isFile() === true;
}

export function isDirectoryOnDisk(path: string): boolean {
    return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}
