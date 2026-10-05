import { join } from 'node:path';

import { isDirectoryOnDisk } from './fs-cache.js';

const LAYERS = ['domain', 'application', 'infrastructure'];

/** Whether a unit lays its sources out as a hexagonal application — `src/domain/`, `src/application/` and `src/infrastructure/` side by side —, which holds it to the hexagonal map unless its settings write `hexagonal: false`. */
export const laidOutHexagonally = (unit: string): boolean =>
    LAYERS.every((layer) => isDirectoryOnDisk(join(unit, 'src', layer)));
