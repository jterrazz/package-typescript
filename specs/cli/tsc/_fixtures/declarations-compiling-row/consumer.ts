import { defineConfig } from '@jterrazz/typescript/config';

// @ts-expect-error — a root maps to the reason the repository keeps it, and this one is a reason
export const root = defineConfig({ typescript: { roots: { scripts: 'the release scripts' } } });
