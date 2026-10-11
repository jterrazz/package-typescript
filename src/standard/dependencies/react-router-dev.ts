import { defineStandard } from '../../../lint/index.config.js';

export default defineStandard({
    typescript: {
        tsconfig: {
            compilerOptions: {
                rootDirs: [`\${configDir}`, `\${configDir}/.react-router/types`],
            },
            include: [`\${configDir}/.react-router/types/**/*`],
            reason: 'React Router writes the types of its routes into .react-router/types and resolves them as siblings of the route modules, which a glob skips because the folder starts with a dot; `typescript check` runs `react-router typegen` first',
        },
    },
});
