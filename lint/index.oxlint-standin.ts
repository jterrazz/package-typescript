import process from 'node:process';
import type { OxlintConfig } from 'oxlint';

import { oxlintConfigAt } from './index.rulebook.js';

const derived: OxlintConfig = await oxlintConfigAt(process.cwd());

export default derived;
