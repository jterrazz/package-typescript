import { astro, bun, expo, hexagonal, nested, next, node, react } from '../lint/index.js';
import oxfmtConfig from './presets/oxfmt/index.js';

export const oxfmt = oxfmtConfig;

export const oxlint = {
    astro,
    bun,
    expo,
    hexagonal,
    nested,
    next,
    node,
    react,
};

export default { oxfmt, oxlint };
