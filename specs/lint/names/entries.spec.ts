import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('entries', () => {
    test('holds a published build to its entry grammar — an entry per subpath named for it, a bin named as one, no other index, no code published from outside the build', async () => {
        // Given - a package whose build names its entries otherwise, keeps a specification index and a bin nothing publishes, publishes a subpath it never builds, and a bin and a module from outside its build
        const result = await lint.fixture(directory('./_fixtures/entries/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/index.rules.node.ts:1:1  names(index-is-an-entry)
                found: \`lint/index.rules.node.ts\` is named \`index\`, and builds nothing the package publishes or imports
                why: A module named index is the entry of a subpath the package publishes or of a private import it declares, or that entry's test.
                fix: name it for what it holds, or build it as an entry: a subpath in \`exports\`, or a private \`#\` import in \`imports\`, built from it
                read: docs/reference/quality-checks.md#the-entry-grammar
            lint/rebuild.bin.ts:1:1  names(bin-is-published)
                found: \`lint/rebuild.bin.ts\` is named \`.bin\`, and builds no bin the package publishes
                why: A module named <command>.bin is the entry of a bin the package publishes under that command, or that entry's test.
                fix: name it for what it runs, or publish it: a bin in the manifest named for its command, built from it
                read: docs/reference/quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: \`./config\` is published as ./dist/config.d.ts, and no source the build compiles builds it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: write its entry, \`index.config.ts\`, at the root of src/ or lint/, or take the subpath out of the manifest
                read: docs/reference/quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: \`./config\` is published as ./dist/config.js, and no source the build compiles builds it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: write its entry, \`index.config.ts\`, at the root of src/ or lint/, or take the subpath out of the manifest
                read: docs/reference/quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: \`./gone\` is published as ./dist/gone.js, and no source the build compiles builds it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: write its entry, \`index.gone.ts\`, at the root of src/ or lint/, or take the subpath out of the manifest
                read: docs/reference/quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: \`./rules\` is published as ./dist/rules.browser.js, and no source the build compiles builds it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: write its entry, \`index.rules.browser.ts\`, at the root of src/ or lint/, or take the subpath out of the manifest
                read: docs/reference/quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: \`./runner\` is published as ./scripts/runner.mjs, outside the build output \`dist/\`, so no source compiles it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: build it from its entry, \`index.runner.ts\`, and publish what the build writes under \`dist/\`
                read: docs/reference/quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: the bin \`legacy\` is published as ./bin/legacy.js, outside the build output \`dist/\`, so no source compiles it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: build it from its entry, \`legacy.bin.ts\`, and publish what the build writes under \`dist/\`
                read: docs/reference/quality-checks.md#the-entry-grammar
            package.json:1:1  names(export-has-an-entry)
                found: the bin \`tool\` is published as ./dist/tool.js, and no source the build compiles builds it
                why: Every subpath and bin the package publishes as code is compiled by its build, from a source the build names.
                fix: write its entry, \`tool.bin.ts\`, at the root of src/ or lint/, or take the subpath out of the manifest
                read: docs/reference/quality-checks.md#the-entry-grammar
            src/specifications/api/index.ts:1:1  names(index-is-an-entry)
                found: \`src/specifications/api/index.ts\` is named \`index\`, and builds nothing the package publishes or imports
                why: A module named index is the entry of a subpath the package publishes or of a private import it declares, or that entry's test.
                fix: name it for what it holds, or build it as an entry: a subpath in \`exports\`, or a private \`#\` import in \`imports\`, built from it
                read: docs/reference/quality-checks.md#the-entry-grammar
        `);
    });

    test('holds a package with no build config of its own to the same grammar — each subpath and bin from its entry under src/', async () => {
        // Given - a package with no tsdown config, publishing `.`, `./config` and a bin, each from the entry the grammar names
        const result = await lint.fixture(directory('./_fixtures/entries-unconfigured/')).run();

        // Then - nothing is refused
        expect(result.report).toMatch('');
    });
});
