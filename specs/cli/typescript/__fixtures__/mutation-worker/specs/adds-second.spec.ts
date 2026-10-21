import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';

import { sum } from '../src/sum.ts';

test('the second spec adds in its own process', () => {
    appendFileSync(String(process.env.WORKER_LOG), `adds ${String(process.env.__STRYKER_ACTIVE_MUTANT__)} ${String(process.pid)}\n`);

    expect(typeof sum(1, 1)).toBe('number');
});
