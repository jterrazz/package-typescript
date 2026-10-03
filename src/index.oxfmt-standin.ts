import process from 'node:process';
import type { OxfmtConfig } from 'oxfmt';

import { oxfmtConfig } from './presets/oxfmt/project.js';

const derived: OxfmtConfig = await oxfmtConfig(process.cwd());

export default derived;
