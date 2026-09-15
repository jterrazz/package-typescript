import { defineConfig, library, type OxlintConfig } from '@jterrazz/typescript/oxlint';

/* `isolatedDeclarations` cannot infer a default export, so this profile names the type. */
const config: OxlintConfig = defineConfig({ extends: [library] });

export default config;
