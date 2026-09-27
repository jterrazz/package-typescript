import type { Finding } from './pass.js';

export function reportLine(
    namespace: string,
    finding: Omit<Finding, 'message'>,
    message: string,
): string {
    const { column, line, path, rule } = finding;

    return `${path}:${String(line ?? 1)}:${String(column ?? 1)}: error ${namespace}(${rule}): ${message}`;
}
