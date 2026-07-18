type ConfigObject = Record<string, unknown>;

declare const expo: ConfigObject;
declare const hexagonal: ConfigObject;
declare const next: ConfigObject;
declare const node: ConfigObject;

/**
 * Deterministic merge of oxlint config fragments, left to right:
 * jsPlugins/plugins/ignorePatterns/extends concatenated + deduped,
 * rules/categories shallow-merged (last wins), overrides concatenated.
 */
declare function compose(...fragments: ConfigObject[]): ConfigObject;

export { compose, expo, hexagonal, next, node };
