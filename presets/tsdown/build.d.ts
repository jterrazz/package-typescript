/*
 * The shape of a bundler config is tsdown's own fact, so this declaration does
 * not restate it: `UserConfig` is re-exported from the tool, for a consumer
 * that annotates its own config ([Developing](../../docs/02-developing.md)).
 */

import type { UserConfig } from 'tsdown';

/** An application build: one ESM output with declarations and source maps. */
declare const build: UserConfig;

export { type UserConfig } from 'tsdown';
export default build;
