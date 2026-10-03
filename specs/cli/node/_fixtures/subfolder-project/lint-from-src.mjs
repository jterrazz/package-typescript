import { spawnSync } from 'node:child_process';

const run = spawnSync('oxlint', ['--format', 'unix', '-c', '../oxlint.config.ts', '.'], {
    cwd: 'src',
    stdio: 'inherit',
});
process.exitCode = run.status ?? 1;
