import { execFileSync } from 'node:child_process';

export function printedOxlintConfig(root, oxlint, configPath) {
    try {
        const printed = execFileSync(
            oxlint,
            configPath === null || configPath === undefined
                ? ['--print-config']
                : ['-c', configPath, '--print-config'],
            { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );

        return JSON.parse(printed);
    } catch {
        return null;
    }
}
