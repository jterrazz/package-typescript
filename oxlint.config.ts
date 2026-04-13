import { defineConfig } from 'oxlint';
import { oxlint } from '@jterrazz/codestyle';

export default defineConfig({
    extends: [oxlint.node],
    ignorePatterns: ['**/fixtures/**'],
});
