import { describe, test } from 'vitest';

import { spec } from '../../setup/cli.specification.js';

describe('cli', () => {
    test('shows help when no command is provided', async () => {
        // Given — no command argument
        const result = await spec('help').project('sample-app').exec('').run();

        // Then — help banner with usage and available commands
        result.stdout.toContain('TYPESCRIPT');
        result.stdout.toContain('Usage: typescript <command>');
        result.stdout.toContain('build');
        result.stdout.toContain('dev');
    });

    test('shows help with unknown command', async () => {
        // Given — unrecognized command
        const result = await spec('unknown').project('sample-app').exec('unknown').run();

        // Then — falls back to usage help
        result.stdout.toContain('Usage: typescript <command>');
    });

    test('lists all commands in help', async () => {
        // Given — no command argument
        const result = await spec('commands').project('sample-app').exec('').run();

        // Then — all commands listed
        result.stdout.toContain('build');
        result.stdout.toContain('bundle');
        result.stdout.toContain('start');
        result.stdout.toContain('dev');
        result.stdout.toContain('docs');
        result.stdout.toContain('check');
        result.stdout.toContain('fix');
    });

    test('shows usage examples in help', async () => {
        // Given — no command argument
        const result = await spec('examples').project('sample-app').exec('').run();

        // Then — usage examples for each command
        result.stdout.toContain('typescript build');
        result.stdout.toContain('typescript bundle');
        result.stdout.toContain('typescript start');
        result.stdout.toContain('typescript dev');
        result.stdout.toContain('typescript check');
        result.stdout.toContain('typescript fix');
    });
});
