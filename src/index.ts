import type { OxlintConfig } from '../lint/index.js';
import { astro, bun, expo, nested, next, node, react } from '../lint/index.js';
import type { OxfmtConfig } from './oxfmt.js';
import oxfmtConfig from './presets/oxfmt/index.js';

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
