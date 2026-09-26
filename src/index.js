import { nested } from '../lint/index.js';
import hexagonalFragment from '../lint/rulebook/architecture/hexagonal.js';
import { compile } from '../lint/rulebook/compile.js';
import oxfmtConfig from './presets/oxfmt/index.js';
import astroProfile from './presets/oxlint/profiles/astro.js';
import bunProfile from './presets/oxlint/profiles/bun.js';
import expoProfile from './presets/oxlint/profiles/expo.js';
import nextProfile from './presets/oxlint/profiles/next.js';
import nodeProfile from './presets/oxlint/profiles/node.js';
import reactProfile from './presets/oxlint/profiles/react.js';

export const oxfmt = oxfmtConfig;

export const oxlint = {
    astro: astroProfile,
    bun: bunProfile,
    expo: expoProfile,
    hexagonal: compile(hexagonalFragment),
    nested,
    next: nextProfile,
    node: nodeProfile,
    react: reactProfile,
};

export default { oxfmt, oxlint };
