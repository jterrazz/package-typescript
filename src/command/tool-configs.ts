import CONFIG_NAMES from '../../lint/engine/project/oxlint-config-names.json' with { type: 'json' };
import { isFile } from './disk.js';
import { presetAt } from './toolchain.js';

const OXFMT_CONFIG_NAMES = [
    '.oxfmtrc.json',
    '.oxfmtrc.jsonc',
    'oxfmt.config.ts',
    'oxfmt.config.mts',
];

export const FIX_WRAPPER = 'oxlint.fix.config.mjs';

export const DEFAULT_OXLINT_CONFIG = presetAt('dist/presets/oxlint/profiles/node.js');

export const DEFAULT_OXFMT_CONFIG = presetAt('dist/presets/oxfmt/index.js');

export type ToolConfigs = {
    oxfmt: { args: string[]; ignoresOf: string | undefined; own: string | undefined };
    oxlint: { args: string[]; ignoresOf: string | undefined; own: string | undefined };
};

// A config handed by path resolves its `ignorePatterns` against this package's directory, where they reach nothing: the sweep applies them instead.
export function toolConfigs(): ToolConfigs {
    const oxlint = CONFIG_NAMES.find((name) => isFile(name));
    const oxfmt = OXFMT_CONFIG_NAMES.find((name) => isFile(name));

    return {
        oxfmt: {
            args: oxfmt === undefined ? ['-c', DEFAULT_OXFMT_CONFIG] : [],
            ignoresOf: oxfmt === undefined ? DEFAULT_OXFMT_CONFIG : undefined,
            own: oxfmt,
        },
        oxlint: {
            args: oxlint === undefined ? ['-c', DEFAULT_OXLINT_CONFIG] : [],
            ignoresOf: oxlint === undefined ? DEFAULT_OXLINT_CONFIG : undefined,
            own: oxlint,
        },
    };
}
