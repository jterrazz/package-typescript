import { join } from 'node:path';

import type { Context, Finding } from '../../kit/checker/pass.js';
import { isRepositoryRoot } from '../../kit/project/repository-root.js';
import { namesFinding } from './names.lessons.js';

// invariant: the only gestures the flows speak; a workspace member owes none of them.
const MAKE_TARGETS = Object.freeze(['install', 'build', 'lint', 'fix', 'test', 'check']);

const MAKEFILE = 'Makefile';

// invariant: a recipe line opens on a tab and never matches; `:=` and `::=` open assignments.
const RULE_LINE = /^(?<targets>[^\s:#=][^:#=]*?)\s*(?:::|:)(?![:=])/u;

function targetsOf(text: string): ReadonlySet<string> {
    const targets = new Set<string>();
    for (const line of text.split('\n')) {
        const match = RULE_LINE.exec(line);
        for (const target of match?.groups?.targets?.split(/\s+/u) ?? []) {
            targets.add(target);
        }
    }

    return targets;
}

// invariant: asked only where a `.git` stands beside the root, so a member, a fixture or a bare directory is never asked.
export function makefileOf({ read, root }: Context, files: readonly string[]): Finding[] {
    if (!isRepositoryRoot(root)) {
        return [];
    }
    const gestures = `${MAKE_TARGETS.slice(0, -1).join(', ')} and ${MAKE_TARGETS.at(-1) ?? ''}`;
    if (!files.includes(MAKEFILE)) {
        return [
            namesFinding('names/repository-has-makefile', MAKEFILE, {
                fix: `write a Makefile whose rules answer \`make\` ${gestures}`,
                found: 'the repository has no Makefile',
            }),
        ];
    }

    const targets = targetsOf(read(join(root, MAKEFILE)) ?? '');

    return MAKE_TARGETS.filter((target) => !targets.has(target)).map((target) =>
        namesFinding('names/makefile-answers-every-gesture', MAKEFILE, {
            fix: `write its rule — every repository answers \`make\` ${gestures}`,
            found: `\`make ${target}\` has no rule`,
        }),
    );
}
