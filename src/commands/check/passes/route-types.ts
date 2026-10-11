import { declaredDependencies } from '../../../../lint/kit/project/manifest.js';
import { reactRouterTyped } from '../../../drivers/react-router/react-router.js';

// invariant: `react-router typegen` writes the route types the unit's tsconfig reads through `rootDirs`, and a fresh clone holds none: the type check starts from them, and prints a failure of the generator in its place.
/** The status of the unit's own `react-router typegen`, or 0 where the unit declares no React Router. */
export async function routeTypesGenerated(unit: string, log: string): Promise<number> {
    return declaredDependencies(unit).has('@react-router/dev')
        ? await reactRouterTyped(unit, log)
        : 0;
}
