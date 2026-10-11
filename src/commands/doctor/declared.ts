import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';

function manifestIn(folder: string): Readonly<Record<string, unknown>> {
    try {
        // Stryker disable next-line StringLiteral: a buffer parses as its text, so the encoding changes nothing the parse could show
        return parsedObject(readFileSync(join(folder, 'package.json'), 'utf8'));
    } catch {
        return {};
    }
}

// outside: in a monorepo the member running browser mode declares the provider, not the root.
export function declaredAnywhere(root: string, name: string): boolean {
    // Stryker disable next-line StringLiteral: the root and an empty member name join to the same folder
    return ['.', ...workspaceMembers(root)].some((member) => {
        const pkg = manifestIn(join(root, member));

        return (
            {
                ...objectOf(pkg.dependencies),
                ...objectOf(pkg.devDependencies),
                ...objectOf(pkg.peerDependencies),
            }[name] !== undefined
        );
    });
}
