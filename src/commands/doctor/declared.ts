import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { objectOf, parsedObject } from '../../../lint/kit/project/json.js';
import { workspaceMembers } from '../../../lint/kit/project/workspace-members.js';

// outside: in a monorepo the member running browser mode declares the provider, not the root.
export function declaredAnywhere(root: string, name: string): boolean {
    // Stryker disable next-line StringLiteral: the root and an empty member name join to the same folder
    return ['.', ...workspaceMembers(root)].some((member) => {
        try {
            // Stryker disable next-line StringLiteral: a buffer parses as its text, so the encoding changes nothing the parse could show
            const pkg = parsedObject(readFileSync(join(root, member, 'package.json'), 'utf8'));
            return (
                {
                    ...objectOf(pkg.dependencies),
                    ...objectOf(pkg.devDependencies),
                    ...objectOf(pkg.peerDependencies),
                }[name] !== undefined
            );
        } catch {
            // Stryker disable next-line BlockStatement: a manifest that cannot be read declares nothing, and an answer of undefined is none either to `some`
            return false;
        }
    });
}
