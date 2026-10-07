import { compose } from '../../../composition/compose.js';

export const useArticles = (): string => compose().name;
