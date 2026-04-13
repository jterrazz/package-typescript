import oxfmtConfig from '../presets/oxfmt/index.js';
import hexagonalConfig from '../presets/oxlint/architectures/hexagonal.js';
import expoConfig from '../presets/oxlint/expo.js';
import nextConfig from '../presets/oxlint/next.js';
import nodeConfig from '../presets/oxlint/node.js';

export const oxfmt = oxfmtConfig;

export const oxlint = {
    expo: expoConfig,
    hexagonal: hexagonalConfig,
    next: nextConfig,
    node: nodeConfig,
};

export default { oxfmt, oxlint };
