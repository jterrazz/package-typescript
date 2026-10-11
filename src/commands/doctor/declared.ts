import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';

// outside: in a monorepo the member running browser mode declares the provider, not the root.
export function declaredAnywhere(root: string, name: string): boolean {
    return ['.', ...workspaceMembers(root)].some((member) => {
        try {
            const pkg = parsedObject(readFileSync(join(root, member, 'package.json'), 'utf8'));
            return (
                {
                    ...objectOf(pkg.dependencies),
                    ...objectOf(pkg.devDependencies),
                    ...objectOf(pkg.peerDependencies),
                }[name] !== undefined
            );
        } catch {
            return false;
        }
    });
}
