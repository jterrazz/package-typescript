import oxfmtConfig from "../config/oxfmt/index.json" with { type: "json" };
import expoConfig from "../config/oxlint/expo.json" with { type: "json" };
import nextConfig from "../config/oxlint/next.json" with { type: "json" };
import nodeConfig from "../config/oxlint/node.json" with { type: "json" };

export const oxfmt = oxfmtConfig;

export const oxlint = {
  expo: expoConfig,
  next: nextConfig,
  node: nodeConfig,
};

export default { oxfmt, oxlint };
