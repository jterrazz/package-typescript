import { clsx } from 'clsx';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { greet } from './greet.js';

export const card = clsx('flex bg-white p-4 text-sm');
export const message = greet(readFileSync(join('data', 'name.txt'), 'utf8'), {
    punctuation: '!',
    uppercase: false,
});
export function shout(text: string) {
    return text.toUpperCase();
}
