import { compile } from '../engine/compiler/compile.js';
import { layers } from '../engine/compiler/layers.js';
import { LINT_DIRECTION } from './checks/lint-direction.js';

export default compile(layers(LINT_DIRECTION));
