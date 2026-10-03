import process from 'node:process';
import type { OxfmtConfig } from 'oxfmt';

import { oxfmtConfigAt } from './presets/oxfmt/project.js';

const derived: OxfmtConfig = await oxfmtConfigAt(process.cwd());

export default derived;
