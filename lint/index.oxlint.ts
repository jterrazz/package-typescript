import type { OxlintConfig } from 'oxlint';

import { oxlintConfigAt } from './index.rulebook.js';

export type { OxlintConfig, OxlintOverride } from 'oxlint';

export type RuleEntry = NonNullable<OxlintConfig['rules']>[string];

export const oxlintConfig = async (config: ImportMeta): Promise<OxlintConfig> =>
    await oxlintConfigAt(config.dirname);
