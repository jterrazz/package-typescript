import { testing } from '@jterrazz/test/oxlint';
import { compose, defineConfig, node } from '@jterrazz/typescript/oxlint';

import self from './dist/self.js';

export default defineConfig(compose(node, testing, self));
