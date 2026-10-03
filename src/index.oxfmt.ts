import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OxfmtConfig } from 'oxfmt';

import { oxfmtConfigAt } from './presets/oxfmt/project.js';

export type {
    OxfmtConfig,
    SortImportsUserConfig as SortImports,
    SortTailwindcssUserConfig as SortTailwindcss,
} from 'oxfmt';

export const oxfmtConfig = async (config: ImportMeta): Promise<OxfmtConfig> =>
    await oxfmtConfigAt(dirname(fileURLToPath(config.url)));
