import type { UserConfig } from 'tsdown';

/** An application build: one ESM output with declarations and source maps. */
declare const build: UserConfig;

export { type UserConfig } from 'tsdown';
export default build;
