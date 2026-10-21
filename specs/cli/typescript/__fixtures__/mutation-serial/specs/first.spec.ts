import { mkdirSync, rmSync } from 'node:fs';
import { setTimeout as pause } from 'node:timers/promises';
import { expect, test } from 'vitest';

import { label } from '../src/label.ts';

const SHARED = String(process.env['SERIAL_LOCK']);

test('the file holds the one app alone while it runs', async () => {
    mkdirSync(SHARED);
    await pause(800);
    rmSync(SHARED, { recursive: true });

    expect(label).toBe('serial');
});
