import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, node } from '@jterrazz/typescript/oxlint';

import self from './lint/self/index.js';

export default defineConfig(compose(node, testing, self));
