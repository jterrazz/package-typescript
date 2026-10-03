import type { OxlintConfig } from 'oxlint';

export type { OxlintConfig, OxlintOverride } from 'oxlint';

export type RuleEntry = NonNullable<OxlintConfig['rules']>[string];

export { oxlintConfig } from './index.rulebook.js';
