import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('entries', () => {
    test('holds a published build to its entry grammar — an entry per subpath named for it, a bin named as one, no other index, no code published from outside the build', async () => {
        // Given - a package whose build names its entries otherwise, keeps a facet index and a bin nothing publishes, publishes a subpath it never builds, and a bin and a module from outside its build
        const result = await lint.fixture(directory('./_fixtures/entries/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/index.rules.node.ts:1:1  names(entry-follows-its-grammar)
                found: \`lint/index.rules.node.ts\` builds \`./rules\` (./dist/rules.browser.js), and is not named \`index.rules.browser.ts\`
                why: The source a published subpath is built from is named index[.<subpath>][.browser].ts, and a bin's <command>.bin.ts.
                fix: rename it \`lint/index.rules.browser.ts\`, its build entry with it — \`node\` is the default runtime and never a variant
                read: docs/07-quality-checks.md#the-entry-grammar
            lint/rebuild.bin.ts:1:1  names(bin-is-published)
                found: \`lint/rebuild.bin.ts\` is named \`.bin\`, and builds no bin the package publishes
                why: A module named <command>.bin is the entry of a bin the package publishes under that command, or that entry's test.
                fix: name it for what it runs, or publish it: a bin in the manifest named for its command, built from it
                read: docs/07-quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: \`./gone\` is published as ./dist/gone.js, and no source the build compiles builds it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: name the source it is built from in the build config, or take the subpath out of the manifest
                read: docs/07-quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: \`./runner\` is published as ./scripts/runner.mjs, outside the build output \`dist/\`, so no source compiles it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: build it from its entry, \`index.runner.ts\`, and publish what the build writes under \`dist/\`
                read: docs/07-quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: the bin \`legacy\` is published as ./bin/legacy.js, outside the build output \`dist/\`, so no source compiles it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: build it from its entry, \`legacy.bin.ts\`, and publish what the build writes under \`dist/\`
                read: docs/07-quality-checks.md#the-entry-grammar
            src/config.ts:1:1  names(entry-follows-its-grammar)
                found: \`src/config.ts\` builds \`./config\` (./dist/config.js), and is not named \`index.config.ts\`
                why: The source a published subpath is built from is named index[.<subpath>][.browser].ts, and a bin's <command>.bin.ts.
                fix: rename it \`src/index.config.ts\`, its build entry with it
                read: docs/07-quality-checks.md#the-entry-grammar
            src/facets/api/index.ts:1:1  names(index-is-an-entry)
                found: \`src/facets/api/index.ts\` is named \`index\`, and builds nothing the package publishes
                why: A module named index is the entry of a subpath the package publishes, or that entry's test.
                fix: name it for what it holds, or publish it: a subpath in \`exports\` built from it
                read: docs/07-quality-checks.md#the-entry-grammar
            src/tool.ts:1:1  names(entry-follows-its-grammar)
                found: \`src/tool.ts\` builds the bin \`tool\` (./dist/tool.js), and is not named \`tool.bin.ts\`
                why: The source a published subpath is built from is named index[.<subpath>][.browser].ts, and a bin's <command>.bin.ts.
                fix: rename it \`src/tool.bin.ts\`, its build entry with it
                read: docs/07-quality-checks.md#the-entry-grammar
        `);
    });

    test('holds a package with no build config of its own to the same grammar — each subpath and bin from its entry under src/', async () => {
        // Given - a package with no tsdown config, publishing `.`, `./config` and a bin, each from the entry the grammar names
        const result = await lint.fixture(directory('./_fixtures/entries-unconfigured/')).run();

        // Then - nothing is refused
        expect(result.report).toMatch('');
    });
});
