import type { ArchitectureRule } from './preset.js';

const pathsOf = (path: unknown): string[] =>
    typeof path === 'string'
        ? [path]
        : Array.isArray(path)
          ? path.filter((one) => typeof one === 'string')
          : [];

const LEADING_FOLDER = /^\^(?<folder>[\w.-]+)\//u;

// invariant: a side whose every path opens on a folder the project does not hold can match no module, so the rule refuses no import: an always-on law costs a project without its tree no cruise.
export function isInert(rule: ArchitectureRule, holds: (folder: string) => boolean): boolean {
    const absent = (side: unknown): boolean => {
        const folders = pathsOf(side).map((path) => LEADING_FOLDER.exec(path)?.groups?.folder);

        return (
            folders.length > 0 && folders.every((folder) => folder !== undefined && !holds(folder))
        );
    };

    return absent(rule.from.path) || absent(rule.to.path);
}
