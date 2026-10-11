import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import process from 'node:process';
import { describe, expect, onTestFinished, test } from 'vitest';

import { routeTypesGenerated } from '../route-types.js';

function unit(manifest: object): string {
    const root = mkdtempSync(join(tmpdir(), 'route-types-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
    writeFileSync(
        join(root, 'node_modules/.bin/react-router'),
        '#!/bin/sh\necho "typegen $*" >> asked.txt\nexit 5\n',
    );
    chmodSync(join(root, 'node_modules/.bin/react-router'), 0o755);

    return relative(process.cwd(), root);
}

const asked = (folder: string): string => {
    try {
        return readFileSync(join(folder, 'asked.txt'), 'utf8');
    } catch {
        return '';
    }
};

describe('routeTypesGenerated', () => {
    test('runs the unit’s own react-router typegen where it declares @react-router/dev, and hands back its status', async () => {
        // Given - a unit declaring the generator among its development dependencies, and one declaring another router
        const routed = unit({ devDependencies: { '@react-router/dev': '^8.0.0' } });
        const other = unit({ devDependencies: { vite: '^8.0.0' } });
        const log = join(tmpdir(), 'route-types.log');

        // When - each is asked to generate
        const statuses = [
            await routeTypesGenerated(routed, log),
            await routeTypesGenerated(other, log),
        ];

        // Then - the first ran the generator and failed with its status, the second ran nothing
        expect([statuses, asked(routed), asked(other)]).toStrictEqual([
            [5, 0],
            'typegen typegen\n',
            '',
        ]);
    });
});
