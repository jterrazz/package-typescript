import type { OxlintConfig } from 'oxlint';

import { compile } from '../engine/compiler/compile.js';
import { layers } from '../engine/compiler/layers.js';
import { LINT_DIRECTION } from './checks/lint-direction.js';

const self: OxlintConfig = compile(layers(LINT_DIRECTION));

export default self;
