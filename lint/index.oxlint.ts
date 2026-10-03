import process from 'node:process';
import type { OxlintConfig } from 'oxlint';

import { oxlintConfigAt } from './index.rulebook.js';

export type { OxlintConfig, OxlintOverride } from 'oxlint';

export type RuleEntry = NonNullable<OxlintConfig['rules']>[string];

const derived: OxlintConfig = await oxlintConfigAt(process.cwd());

export default derived;
