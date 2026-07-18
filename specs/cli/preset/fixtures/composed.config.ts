import { testing } from '@jterrazz/test/oxlint';
import { defineConfig } from 'oxlint';

import { compose, node } from '@jterrazz/typescript/oxlint';

// The consumer wiring under test: a config that explicitly composes the
// Testing fragment into the node preset (resolved from this repo's tree).
export default defineConfig(compose(node, testing));
