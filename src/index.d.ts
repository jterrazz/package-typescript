import { type OxfmtConfig } from './oxfmt.js';
import { type OxlintConfig } from './oxlint.js';

declare const oxfmtConfig: OxfmtConfig;

declare const oxlintProfiles: {
    astro: OxlintConfig;
    bun: OxlintConfig;
    expo: OxlintConfig;
    hexagonal: OxlintConfig;
    library: OxlintConfig;
    next: OxlintConfig;
    node: OxlintConfig;
};

declare const defaultExport: {
    oxfmt: typeof oxfmtConfig;
    oxlint: typeof oxlintProfiles;
};

export { oxfmtConfig as oxfmt, oxlintProfiles as oxlint };
export default defaultExport;
