import process from 'node:process';
import type { OxfmtConfig } from 'oxfmt';

import { oxfmtConfigAt } from './presets/oxfmt/project.js';

export type {
    OxfmtConfig,
    SortImportsUserConfig as SortImports,
    SortTailwindcssUserConfig as SortTailwindcss,
} from 'oxfmt';

const derived: OxfmtConfig = await oxfmtConfigAt(process.cwd());

export default derived;
