import { RULES } from '../../catalogue/manifest.js';
import { listFiles, listFolders, tree } from '../../checks/tree.js';

export const tidy = listFiles(tree).concat(listFolders(tree), RULES);
