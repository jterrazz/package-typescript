import { join } from 'node:path';

import {
    binaryIn,
    HOISTED_BESIDE_PACKAGE,
    PACKAGE_ROOT,
} from '../../../lint/kit/project/package-root.js';

export const rumdlBinary = (): string => binaryIn('rumdl', HOISTED_BESIDE_PACKAGE);

export const RUMDL_CONFIG = join(PACKAGE_ROOT, 'src/presets/rumdl/rumdl.toml');
