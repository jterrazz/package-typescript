import { RULES } from '../../catalogue/manifest.js';
import { listFiles, tree } from '../../checks/tree.js';

export const tidy = listFiles(tree).concat(RULES);
