import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const CHECKOUT = resolve(import.meta.dirname, '../../../..');

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function pack(...flags: string[]): { filename: string; paths: string[] } {
    const run = spawnSync('npm', ['pack', '--json', '--ignore-scripts', ...flags], {
        cwd: CHECKOUT,
        encoding: 'utf8',
    });
    if (run.status !== 0) {
        throw new Error(`npm pack failed: ${run.stderr}`);
    }
    // npm 10 prints one report per package in an array, npm 12 keys them by name.
    const printed: unknown = JSON.parse(run.stdout);
    const reports: unknown[] = Array.isArray(printed)
        ? printed
        : Object.values(isRecord(printed) ? printed : {});
    const [report] = reports;
    if (!isRecord(report) || typeof report.filename !== 'string' || !Array.isArray(report.files)) {
        throw new Error(`npm pack printed no report: ${run.stdout}`);
    }
    const files: unknown[] = report.files;

    return {
        filename: report.filename,
        paths: files.map((file) => (isRecord(file) ? String(file.path) : '')),
    };
}

export function unpackedInto(destination: string): string {
    const { filename } = pack('--pack-destination', destination);
    const run = spawnSync('tar', ['-xzf', filename], { cwd: destination, encoding: 'utf8' });
    if (run.status !== 0) {
        throw new Error(`the tarball did not extract: ${run.stderr}`);
    }

    return join(destination, 'package');
}
