import process from 'node:process';
import type { OxlintConfig } from 'oxlint';

import { oxlintConfig } from './index.rulebook.js';

const derived: OxlintConfig = await oxlintConfig(process.cwd());

export default derived;
