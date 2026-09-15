import { base, defineConfig, type OxfmtConfig } from '@jterrazz/typescript/oxfmt';

/* `isolatedDeclarations` cannot infer a default export, so this profile names the type. */
const config: OxfmtConfig = defineConfig(base);

export default config;
