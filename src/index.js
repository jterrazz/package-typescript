import oxfmtConfig from '../presets/oxfmt/index.js';
import astroProfile from '../presets/oxlint/profiles/astro.js';
import bunProfile from '../presets/oxlint/profiles/bun.js';
import expoProfile from '../presets/oxlint/profiles/expo.js';
import libraryProfile from '../presets/oxlint/profiles/library.js';
import nextProfile from '../presets/oxlint/profiles/next.js';
import nodeProfile from '../presets/oxlint/profiles/node.js';
import reactProfile from '../presets/oxlint/profiles/react.js';
import hexagonalFragment from '../rules/architecture/hexagonal.js';
import { compile } from '../rules/compile.js';
import { nested } from './oxlint.js';

export const oxfmt = oxfmtConfig;

export const oxlint = {
    astro: astroProfile,
    bun: bunProfile,
    expo: expoProfile,
    hexagonal: compile(hexagonalFragment),
    library: libraryProfile,
    nested,
    next: nextProfile,
    node: nodeProfile,
    react: reactProfile,
};

export default { oxfmt, oxlint };
