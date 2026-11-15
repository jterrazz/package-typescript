import { relative } from 'node:path';
import { cwd } from 'node:process';

import { UNCRUISED_PATHS } from '../../kit/project/ground.js';

const escaped = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

// invariant: a workspace member is a unit of its own, cruised by its own run against its own map, so the root's cruise leaves it out.
/** The paths a unit's cruise leaves out: the ground of a test, a run's output, and each workspace member it holds. */
export function uncruisedOf(members: readonly string[]): string {
    return members.length === 0
        ? UNCRUISED_PATHS
        : `${UNCRUISED_PATHS}|^(${members.map((member) => escaped(member)).join('|')})/`;
}

// invariant: a member's run is started from the workspace root, and its findings name their files from there.
/** What a unit's paths are prefixed with to name them from the folder the run started in: nothing for that folder itself, or for a unit outside it. */
export function unitPrefixOf(root: string): string {
    const unit = relative(cwd(), root);

    return unit === '' || unit.startsWith('..') ? '' : `${unit}/`;
}
