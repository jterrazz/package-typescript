import { WALK_DEPTH } from './tree.js';

export function walkTree(root) {
    return [root].slice(0, WALK_DEPTH);
}
