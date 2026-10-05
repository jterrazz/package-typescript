import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { srcLayoutFindings } from './src-layout.js';

const ROOT = resolve(import.meta.dirname, '../../..');

function findingsIn(files: Readonly<Record<string, string>>): string[] {
    const root = mkdtempSync(join(tmpdir(), 'src-layout-'));
    try {
        for (const [path, text] of Object.entries(files)) {
            mkdirSync(join(root, dirname(path)), { recursive: true });
            writeFileSync(join(root, path), text);
        }

        return srcLayoutFindings(root).map(
            ({ message, path }) => `${path}  ${message.slice(0, message.indexOf(' · why: '))}`,
        );
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
}

describe('srcLayoutFindings', () => {
    test('every subcommand is its folder of src/commands/, and every tool is driven from its own folder of src/drivers/', () => {
        // Given - this checkout's src/
        const findings = srcLayoutFindings(ROOT);

        // Then - it keeps both
        expect(findings).toStrictEqual([]);
    });

    test('names a subcommand outside its folder, a process spawned or a binary resolved outside a driver, a tool package imported or resolved outside its driver or its preset, and a driver reaching another or a command', () => {
        // Given - a tree that breaks each lock once, beside what each lock allows
        const lines = findingsIn({
            'src/commands/main.ts':
                "const COMMANDS = { build, 'docs-layout': docsLayout, start };\n",
            'src/commands/build/build.command.ts':
                "import { run } from '../../drivers/run.js';\nimport { isExecutable } from '../../../lint/kit/project/package-root.js';\n",
            'src/commands/docs-layout/docs-layout.command.ts':
                "import { spawn } from 'node:child_process';\nimport { binaryIn } from '../../../lint/kit/project/package-root.js';\n",
            'src/commands/orphan/orphan.ts': '',
            'src/commands/docs-layout/checked.ts':
                "import { runTool } from '../../../lint/kit/checker/tool-run.js';\nconst depcruise = createRequire(import.meta.url).resolve('dependency-cruiser');\nconst plugin = require.resolve('prettier-plugin-astro');\nconst checker = createRequire(import.meta.url).resolve('#checker');\n",
            'src/commands/shared/doctor.command.ts': '',
            'src/drivers/run.ts': "import { spawn } from 'node:child_process';\n",
            'src/drivers/knip/knip.ts':
                "import knip from 'knip';\nconst bin = createRequire(import.meta.url).resolve('knip/bin');\nimport { run } from '../run.js';\nimport type { OxlintConfig } from 'oxlint';\nimport { oxlint } from '../oxlint/oxlint.js';\nimport { build } from '../../commands/build/build.command.js';\n",
            'src/drivers/oxlint/oxlint.ts': "import { lint } from 'oxlint';\n",
            'src/drivers/oxfmt/format.ts': '',
            'src/index.command.ts': "export { main } from './commands/main.js';\n",
            'src/presets/oxfmt/style.ts': "import { defineConfig } from 'oxfmt';\n",
            'src/index.oxfmt.ts':
                "import { format } from 'oxfmt';\nexport type { OxfmtConfig } from 'oxfmt';\n",
        });

        // Then - each breach once, at its module, in four parts
        expect(lines).toStrictEqual([
            'src/commands/orphan/  src-layout  found: `src/commands/orphan/` holds no `orphan.command.ts`',
            'src/commands/shared/  src-layout  found: `src/commands/shared/` holds no `shared.command.ts`',
            'src/commands/shared/doctor.command.ts  src-layout  found: `src/commands/shared/doctor.command.ts` is a command module outside its folder',
            'src/commands/main.ts  src-layout  found: the subcommand `start` has no folder under src/commands/',
            'src/commands/orphan/  src-layout  found: `src/commands/orphan/` is a subcommand src/commands/main.ts does not dispatch',
            'src/commands/shared/  src-layout  found: `src/commands/shared/` is a subcommand src/commands/main.ts does not dispatch',
            'src/drivers/oxfmt/  src-layout  found: `src/drivers/oxfmt/` holds no `oxfmt.ts`',
            'src/commands/build/build.command.ts  src-layout  found: `src/commands/build/build.command.ts` spawns a process through `../../drivers/run.js`',
            "src/commands/build/build.command.ts  src-layout  found: `src/commands/build/build.command.ts` resolves a tool's binary",
            'src/commands/docs-layout/checked.ts  src-layout  found: `src/commands/docs-layout/checked.ts` spawns a process through `../../../lint/kit/checker/tool-run.js`',
            'src/commands/docs-layout/checked.ts  src-layout  found: `src/commands/docs-layout/checked.ts` imports `dependency-cruiser`, the package of the tool src/drivers/dependency-cruiser/ drives',
            'src/commands/docs-layout/checked.ts  src-layout  found: `src/commands/docs-layout/checked.ts` imports `prettier-plugin-astro`, the package of the tool src/drivers/prettier/ drives',
            'src/commands/docs-layout/docs-layout.command.ts  src-layout  found: `src/commands/docs-layout/docs-layout.command.ts` spawns a process through `node:child_process`',
            "src/commands/docs-layout/docs-layout.command.ts  src-layout  found: `src/commands/docs-layout/docs-layout.command.ts` resolves a tool's binary",
            "src/drivers/knip/knip.ts  src-layout  found: `src/drivers/knip/knip.ts` imports `src/drivers/oxlint/oxlint.ts`, another tool's driver",
            'src/drivers/knip/knip.ts  src-layout  found: `src/drivers/knip/knip.ts` imports `src/commands/build/build.command.ts`, a command',
            'src/index.oxfmt.ts  src-layout  found: `src/index.oxfmt.ts` imports `oxfmt`, the package of the tool src/drivers/oxfmt/ drives',
        ]);
    });
});
