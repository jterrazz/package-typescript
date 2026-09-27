import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';

import { readCommandLine } from './command-line.js';

// The rule ids are the config's own `name`s: the one gate whose vocabulary the consumer writes.

const CONFIGS = ['.dependency-cruiser.cjs', '.dependency-cruiser.js', '.dependency-cruiser.mjs'];

const ROOTS = ['apps', 'lib', 'packages'];

export function architecture(args: readonly string[]): number {
    const commandLine = readCommandLine(args, ['--depcruise']);
    const root = resolve(commandLine.positionals[0] ?? '.');

    const config = CONFIGS.find((name) => existsSync(join(root, name)));
    if (config === undefined) {
        return 0;
    }

    const cruised = existsSync(join(root, 'src'))
        ? ['src']
        : ROOTS.filter((name) => existsSync(join(root, name)));

    if (cruised.length === 0) {
        stdout.write(
            `${config} declares a layer map, but there is no src/, apps/, packages/ or lib/ to cruise\n`,
        );

        return 1;
    }

    /* dependency-cruiser refuses a cruise of nothing. */
    const populated = cruised.filter((name) => readdirSync(join(root, name)).length > 0);
    if (populated.length === 0) {
        return 0;
    }

    const run = spawnSync(
        commandLine.value('--depcruise', 'depcruise'),
        ['--config', config, '--output-type', 'err-long', ...populated],
        { cwd: root, encoding: 'utf8' },
    );

    if (run.error !== undefined) {
        stdout.write(`depcruise could not be run: ${run.error.message}\n`);

        return 1;
    }

    if (run.status !== 0) {
        stdout.write(`${run.stdout ?? ''}${run.stderr ?? ''}`);
    }

    return run.status === 0 ? 0 : 1;
}
