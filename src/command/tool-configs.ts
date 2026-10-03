import { join } from 'node:path';
import process from 'node:process';

import {
    OXFMT_CONFIG_NAMES,
    OXLINT_CONFIG_NAMES,
} from '../../lint/kit/project/editor-config-names.js';
import { isFileOnDisk } from './disk.js';
import { presetAt } from './toolchain.js';

export type ToolConfig = {
    args: string[];
    ignoresOf: string | undefined;
    own: string | undefined;
    path: string;
};

export type ToolConfigs = { oxfmt: ToolConfig; oxlint: ToolConfig };

function configOf(names: readonly string[], standIn: string): ToolConfig {
    const own = names.find((name) => isFileOnDisk(name));
    if (own !== undefined) {
        return { args: [], ignoresOf: undefined, own, path: join(process.cwd(), own) };
    }
    const path = presetAt(standIn);

    return { args: ['-c', path], ignoresOf: path, own: undefined, path };
}

export function toolConfigs(): ToolConfigs {
    return {
        oxfmt: configOf(OXFMT_CONFIG_NAMES, 'dist/oxfmt-standin.js'),
        oxlint: configOf(OXLINT_CONFIG_NAMES, 'dist/oxlint-standin.js'),
    };
}
