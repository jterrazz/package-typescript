import { join } from 'node:path';

import { objectOf } from '../../../lint/kit/project/json.js';
import { readManifest } from '../../../lint/kit/project/manifest.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';

// outside: in a monorepo the member running browser mode declares the provider, not the root.
export function declaredAnywhere(root: string, name: string): boolean {
    // Stryker disable next-line StringLiteral: the root and an empty member name join to the same folder
    return ['.', ...workspaceMembers(root)].some((member) => {
        const pkg = readManifest(join(root, member)) ?? {};

        return (
            {
                ...objectOf(pkg.dependencies),
                ...objectOf(pkg.devDependencies),
                ...objectOf(pkg.peerDependencies),
            }[name] !== undefined
        );
    });
}
