import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import process from 'node:process';
import { afterAll, describe, expect, test } from 'vitest';

import { reactRouterTyped } from '../react-router.js';

const created: string[] = [];

afterAll(() => {
    for (const root of created) {
        rmSync(root, { force: true, recursive: true });
    }
});

describe('react-router', () => {
    test("reactRouterTyped — runs the unit's own react-router typegen in the unit, its report appended to the log", async () => {
        // Given - a unit whose react-router records where it is run and what it is asked, and fails with status 4
        const root = mkdtempSync(join(tmpdir(), 'react-router-typegen-'));
        created.push(root);
        mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
        writeFileSync(
            join(root, 'node_modules/.bin/react-router'),
            [
                '#!/bin/sh',
                'echo "react-router $* in $(basename "$PWD")" >> asked.txt',
                'echo "typed"',
                'exit 4',
                '',
            ].join('\n'),
        );
        chmodSync(join(root, 'node_modules/.bin/react-router'), 0o755);
        const log = join(root, 'typegen.log');
        writeFileSync(log, 'before\n');

        // When - the unit is typed
        const status = await reactRouterTyped(relative(process.cwd(), root), log);

        // Then - the command's status, the argument, the unit's own folder as working directory, and the report after what the log held
        expect([
            status,
            readFileSync(join(root, 'asked.txt'), 'utf8'),
            readFileSync(log, 'utf8'),
        ]).toStrictEqual([
            4,
            `react-router typegen in ${relative(tmpdir(), root)}\n`,
            'before\ntyped\n',
        ]);
    });
});
