import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';

export type RecordingTool = { binary: string; calls: () => unknown[]; directory: string };

/** A tool that prints a line on each stream and records each call: its arguments, and whether its stdout was dropped. */
export function recordingTool(): RecordingTool {
    const directory = mkdtempSync(join(tmpdir(), 'recording-tool-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    const record = join(directory, 'calls.jsonl');
    const binary = join(directory, 'tool');
    writeFileSync(record, '');
    writeFileSync(
        binary,
        `#!${process.execPath}
const { appendFileSync, fstatSync, statSync } = require('node:fs');
const silent = fstatSync(1).rdev === statSync('/dev/null').rdev;
appendFileSync(${JSON.stringify(record)}, JSON.stringify({ args: process.argv.slice(2), silent }) + '\\n');
process.stdout.write('printed\\n');
process.stderr.write('warned\\n');
`,
        { mode: 0o755 },
    );

    return {
        binary,
        calls: () =>
            readFileSync(record, 'utf8')
                .split('\n')
                .filter((line) => line !== '')
                .map((line): unknown => JSON.parse(line)),
        directory,
    };
}
