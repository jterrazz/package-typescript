import oxfmtConfig from "../presets/oxfmt/index.json" with { type: "json" };
import expoConfig from "../presets/oxlint/expo.json" with { type: "json" };
import nextConfig from "../presets/oxlint/next.json" with { type: "json" };
import nodeConfig from "../presets/oxlint/node.json" with { type: "json" };

export const oxfmt = oxfmtConfig;

export const oxlint = {
  expo: expoConfig,
  next: nextConfig,
  node: nodeConfig,
};

export default { oxfmt, oxlint };
