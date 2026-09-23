/*
 * The family's settings entry (`@jterrazz/typescript/config`): the one file a
 * repository states its settings in, `jterrazz.config.ts` at its root, one
 * section per package of the family.
 *
 *     import { defineConfig } from '@jterrazz/typescript/config';
 *
 *     export default defineConfig({ typescript: { roots: { scripts: 'reason' } } });
 *
 * The value is returned as written: the shape is a type, and each section is
 * read and judged by the package that owns it.
 */

export function defineConfig(config) {
    return config;
}
