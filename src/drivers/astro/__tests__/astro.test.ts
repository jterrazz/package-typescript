import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import { afterAll, describe, expect, test } from 'vitest';

import { astroChecked, astroEntrypointsOf, astroSynced } from '../astro.js';

const created: string[] = [];

afterAll(() => {
    for (const root of created) {
        rmSync(root, { force: true, recursive: true });
    }
});

function unit(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(join(tmpdir(), 'astro-entrypoints-'));
    created.push(root);
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }

    return root;
}

const relativeTo = (root: string): string => relative(process.cwd(), root);

describe('astro', () => {
    test('astroEntrypointsOf — the local modules the Astro config loads by an entrypoint path, and neither a package, a path outside the unit nor a missing file', () => {
        // Given - a config naming a local image service, a renderer without its ./, a package's server, a module above the unit and one that is not there; a unit whose config is TypeScript; one with none
        const site = unit({
            'astro.config.mjs': [
                'export default {',
                "    image: { service: { entrypoint: './src/images/service.ts' } },",
                '    renderers: [{ entrypoint: "src/render/renderer.tsx" }],',
                "    adapter: { entrypoint: '@astrojs/node/server.js' },",
                "    above: { entrypoint: '../shared/service.ts' },",
                "    gone: { entrypoint: './src/gone.ts' },",
                '};',
            ].join('\n'),
            'src/images/service.ts': '',
            'src/render/renderer.tsx': '',
        });
        const nested = unit({
            'shared/service.ts': '',
            'site/astro.config.mjs':
                "export default { image: { service: { entrypoint: '../shared/service.ts' } } };",
        });
        const typed = unit({
            'astro.config.ts':
                "export default { a: { entrypoint : './src/a.mjs' }, b: { entrypoint:'./src/b.mts' } };",
            'src/a.mjs': '',
            'src/b.mts': '',
        });

        // Then - the two local modules in the order the config names them, nothing of a module above the unit though it is there, the typed config's two however its colons are spaced, and nothing where no config is
        expect([
            astroEntrypointsOf(site),
            astroEntrypointsOf(join(nested, 'site')),
            astroEntrypointsOf(typed),
            astroEntrypointsOf(unit({})),
        ]).toStrictEqual([
            ['src/images/service.ts', 'src/render/renderer.tsx'],
            [],
            ['src/a.mjs', 'src/b.mts'],
            [],
        ]);
    });

    test("astroSynced and astroChecked — run the unit's own astro, sync alone, then check without syncing again over a tsconfig whose root files are the templates", async () => {
        // Given - a unit whose astro records what it is asked and syncs with status 3, once with a tsconfig.json and once without
        const astro = [
            '#!/bin/sh',
            'echo "astro $*" >> asked.txt',
            'echo "said $1"',
            'if [ "$1" = sync ]; then exit 3; fi',
            '',
        ].join('\n');
        const withConfig = unit({ 'node_modules/.bin/astro': astro, 'tsconfig.json': '{}' });
        const bare = unit({ 'node_modules/.bin/astro': astro });
        for (const root of [withConfig, bare]) {
            chmodSync(join(root, 'node_modules/.bin/astro'), 0o755);
        }
        const log = join(withConfig, 'astro.log');
        writeFileSync(log, 'before\n');

        // When - each unit is synced, then checked
        const statuses = [
            await astroSynced(relativeTo(withConfig), log),
            await astroChecked(relativeTo(withConfig), log),
            await astroChecked(relativeTo(bare), join(bare, 'astro.log')),
        ];

        // Then - the sync's status, both reports appended to the log, the derived tsconfig handed over, and plain check where the unit keeps none
        expect([
            statuses,
            readFileSync(join(withConfig, 'asked.txt'), 'utf8'),
            readFileSync(log, 'utf8'),
            readFileSync(join(withConfig, '.artifacts/astro/tsconfig.json'), 'utf8'),
            readFileSync(join(bare, 'asked.txt'), 'utf8'),
        ]).toStrictEqual([
            [3, 0, 0],
            'astro sync\nastro check --noSync --tsconfig .artifacts/astro/tsconfig.json\n',
            'before\nsaid sync\nsaid check\n',
            `${JSON.stringify(
                {
                    exclude: ['../../node_modules', '../../dist', '../../.artifacts'],
                    extends: '../../tsconfig.json',
                    include: ['../../**/*.astro', '../../.astro/types.d.ts'],
                },
                null,
                4,
            )}\n`,
            'astro check --noSync\n',
        ]);
    });
});
