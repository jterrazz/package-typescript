import type { OxlintConfig } from '../lint/index.oxlint.js';
import { astro, bun, expo, nested, next, node, react } from '../lint/index.oxlint.js';
import type { OxfmtConfig } from './index.oxfmt.js';
import oxfmtConfig from './presets/oxfmt/style.js';

export const oxfmt: OxfmtConfig = oxfmtConfig;

export const oxlint: {
    astro: OxlintConfig;
    bun: OxlintConfig;
    expo: OxlintConfig;
    nested: (config: OxlintConfig) => OxlintConfig;
    next: OxlintConfig;
    node: OxlintConfig;
    react: OxlintConfig;
} = {
    astro,
    bun,
    expo,
    nested,
    next,
    node,
    react,
};

const presets: { oxfmt: OxfmtConfig; oxlint: typeof oxlint } = { oxfmt, oxlint };

export default presets;
