type ConfigObject = Record<string, unknown>;

declare const oxfmtConfig: ConfigObject;

declare const oxlintPresets: {
    expo: ConfigObject;
    hexagonal: ConfigObject;
    next: ConfigObject;
    node: ConfigObject;
};

declare const defaultExport: {
    oxfmt: typeof oxfmtConfig;
    oxlint: typeof oxlintPresets;
};

export { oxfmtConfig as oxfmt, oxlintPresets as oxlint };
export default defaultExport;
