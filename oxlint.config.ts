// Consumer #1 of our own profile model (self-reference via the exports map).
import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, library } from '@jterrazz/typescript/oxlint';

export default defineConfig(compose(library, testing));
