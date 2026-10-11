import { conventionsOf } from '../../../lint/kit/project/build-plan.js';
import type { Derived } from '../../../lint/kit/project/origins.js';
import type { Resolved } from '../../../lint/kit/project/preset.js';

/** What the tree derives for a unit and the settings files do not state: the build's entries and dev scripts, and what each preset derives for its own section. */
export function derivedOf(unit: string, resolved: Resolved): Derived {
    const { dev, entries } = conventionsOf(unit).settings;
    const build = {
        ...(Object.keys(entries).length === 0 ? {} : { entries }),
        ...(Object.keys(dev).length === 0 ? {} : { dev }),
    };

    return {
        ...(Object.keys(build).length === 0 ? {} : { build }),
        ...Object.fromEntries(
            resolved.presets.flatMap(({ derive, name }) =>
                derive === undefined ? [] : [[name, derive(unit)]],
            ),
        ),
    };
}
