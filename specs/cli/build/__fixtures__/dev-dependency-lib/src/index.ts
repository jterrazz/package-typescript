import { defineConfig } from 'toolchain/config';

export const preset = (): ReturnType<typeof defineConfig> => defineConfig({ strict: true });
