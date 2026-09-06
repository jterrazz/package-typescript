// Consumer #1 of our own composable model (self-reference via the exports map).
import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, node } from '@jterrazz/typescript/oxlint';

export default defineConfig(
    compose(node, testing, {
        ignorePatterns: ['dist', 'node_modules', '**/_fixtures/**'],
    }),
);
