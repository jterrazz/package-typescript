import type { OxlintConfig } from '../lint/index.js';
import type { OxfmtConfig } from './oxfmt.js';

declare const oxfmtConfig: OxfmtConfig;

declare const oxlintProfiles: {
    astro: OxlintConfig;
    bun: OxlintConfig;
    expo: OxlintConfig;
    hexagonal: OxlintConfig;
    nested: (config: OxlintConfig) => OxlintConfig;
    next: OxlintConfig;
    node: OxlintConfig;
    react: OxlintConfig;
};

declare const defaultExport: {
    oxfmt: typeof oxfmtConfig;
    oxlint: typeof oxlintProfiles;
};

export { oxfmtConfig as oxfmt, oxlintProfiles as oxlint };
export default defaultExport;
