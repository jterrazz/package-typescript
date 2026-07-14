type ConfigObject = Record<string, unknown>;

export declare const oxfmt: ConfigObject;

export declare const oxlint: {
    expo: ConfigObject;
    hexagonal: ConfigObject;
    next: ConfigObject;
    node: ConfigObject;
};

declare const _default: {
    oxfmt: typeof oxfmt;
    oxlint: typeof oxlint;
};

export default _default;
