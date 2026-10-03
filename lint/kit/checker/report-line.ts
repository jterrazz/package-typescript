import type { Finding } from './pass.js';

export function reportLine({ column, line, message, path, rule }: Finding): string {
    const [namespace = '', ...name] = rule.split('/');

    return `${path}:${String(line ?? 1)}:${String(column ?? 1)}: error ${namespace}(${name.join('/')}): ${message}`;
}
