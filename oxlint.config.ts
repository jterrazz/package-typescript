// Consumer #1 of our own composable model (self-reference via the exports map).
import { testing } from '@jterrazz/test/oxlint';
import { compose, node } from '@jterrazz/typescript/oxlint';
import { defineConfig } from 'oxlint';

export default defineConfig(
    compose(node, testing, {
        ignorePatterns: ['dist', 'node_modules', '**/fixtures/**'],
    }),
);
