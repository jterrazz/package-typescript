import { OXLINT_CONFIG_NAMES } from '../../lint/kit/project/oxlint-config-names.js';
import { isFileOnDisk } from './disk.js';
import { presetAt } from './toolchain.js';

const OXFMT_CONFIG_NAMES = [
    '.oxfmtrc.json',
    '.oxfmtrc.jsonc',
    'oxfmt.config.ts',
    'oxfmt.config.mts',
];

export const DEFAULT_OXLINT_CONFIG = presetAt('dist/oxlint.js');

export const DEFAULT_OXFMT_CONFIG = presetAt('dist/oxfmt.js');

export type ToolConfigs = {
    oxfmt: { args: string[]; ignoresOf: string | undefined; own: string | undefined };
    oxlint: { args: string[]; ignoresOf: string | undefined; own: string | undefined };
};

export function toolConfigs(): ToolConfigs {
    const oxlint = OXLINT_CONFIG_NAMES.find((name) => isFileOnDisk(name));
    const oxfmt = OXFMT_CONFIG_NAMES.find((name) => isFileOnDisk(name));

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
