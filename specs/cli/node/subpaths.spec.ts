import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('subpaths', () => {
    test('every target the exports map publishes is in the install, and loads under its condition', async () => {
        // Given - a consumer's project with the tarball installed
        const result = await cli
            .fixture(directory('./_fixtures/consumer/'))
            .exec('node subpaths.mjs');

        // Then - each subpath answers every condition it declares: node loads its builds and parses its presets, the browser build reaches no package
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            @jterrazz/typescript (types) → ./dist/index.d.ts: held
            @jterrazz/typescript (default) → ./dist/index.js: loads, 3 names
            @jterrazz/typescript/config (types) → ./dist/config.d.ts: held
            @jterrazz/typescript/config (default) → ./dist/config.js: loads, 3 names
            @jterrazz/typescript/docs (types) → ./dist/docs.d.ts: held
            @jterrazz/typescript/docs (default) → ./dist/docs.js: loads, 2 names
            @jterrazz/typescript/oxfmt (types) → ./dist/oxfmt.d.ts: held
            @jterrazz/typescript/oxfmt (default) → ./dist/oxfmt.js: loads, 2 names
            @jterrazz/typescript/oxlint (types) → ./dist/oxlint.d.ts: held
            @jterrazz/typescript/oxlint (default) → ./dist/oxlint.js: loads, 11 names
            @jterrazz/typescript/rules (types) → ./dist/rules.d.ts: held
            @jterrazz/typescript/rules (browser) → ./dist/rules.browser.js: reaches 5 modules, and imports no package
            @jterrazz/typescript/rules (default) → ./dist/rules.js: loads, 84 names
            @jterrazz/typescript/tsconfig/astro (default) → ./src/presets/tsconfig/astro.json: parses, 21 compiler options
            @jterrazz/typescript/tsconfig/expo (default) → ./src/presets/tsconfig/expo.json: parses, 21 compiler options
            @jterrazz/typescript/tsconfig/library (default) → ./src/presets/tsconfig/library.json: parses, 3 compiler options
            @jterrazz/typescript/tsconfig/next (default) → ./src/presets/tsconfig/next.json: parses, 22 compiler options
            @jterrazz/typescript/tsconfig/node (default) → ./src/presets/tsconfig/node.json: parses, 21 compiler options
            @jterrazz/typescript/tsconfig/react (default) → ./src/presets/tsconfig/react.json: parses, 21 compiler options
            @jterrazz/typescript/tsconfig/astro.json (default) → ./src/presets/tsconfig/astro.json: parses, 21 compiler options
            @jterrazz/typescript/tsconfig/expo.json (default) → ./src/presets/tsconfig/expo.json: parses, 21 compiler options
            @jterrazz/typescript/tsconfig/library.json (default) → ./src/presets/tsconfig/library.json: parses, 3 compiler options
            @jterrazz/typescript/tsconfig/next.json (default) → ./src/presets/tsconfig/next.json: parses, 22 compiler options
            @jterrazz/typescript/tsconfig/node.json (default) → ./src/presets/tsconfig/node.json: parses, 21 compiler options
            @jterrazz/typescript/tsconfig/react.json (default) → ./src/presets/tsconfig/react.json: parses, 21 compiler options
            @jterrazz/typescript/tsdown/build (types) → ./dist/tsdown/build.d.ts: held
            @jterrazz/typescript/tsdown/build (default) → ./dist/tsdown/build.js: loads, 1 names
            @jterrazz/typescript/tsdown/bundle (types) → ./dist/tsdown/bundle.d.ts: held
            @jterrazz/typescript/tsdown/bundle (default) → ./dist/tsdown/bundle.js: loads, 1 names
        `);
    });

    test('every entry publishes the names a consumer imports, and the `.` entry repeats the presets its siblings hand out', async () => {
        // Given - a consumer's project importing each entry by its published name
        const result = await cli.fixture(directory('./_fixtures/consumer/')).exec('node names.mjs');

        // Then - the surface is exactly these names, and the `.` entry's presets are the very ones the oxlint and oxfmt entries hand out
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            @jterrazz/typescript: default, oxfmt, oxlint
            @jterrazz/typescript/config: defineConfig, definePreset, typescript
            @jterrazz/typescript/docs: HEAD_LINES, auditDocs
            @jterrazz/typescript/oxfmt: base, defineConfig
            @jterrazz/typescript/oxlint: UNSAFE_FIXERS, astro, bun, compose, defineConfig, expo, fromPresets, nested, next, node, react
            @jterrazz/typescript/rules: BASELINE, GROUND_EXPECTED, GROUND_FIXTURES, GROUND_FOLDERS, GROUND_GLOB, GROUND_REQUESTS, GROUND_SEEDS, LESSON_PARTS, MEMBER_DEPTH, OXLINT_CONFIG_NAMES, OXLINT_SUPPRESSIONS, PRUNED, RESERVED_FOLDERS, SETUP_FOLDER, SHARED_FOLDER, UNMARKED_RESERVED, anchor, anchorsOf, blankComments, byName, cell, countsOf, declaredSubpaths, defineCheck, defineInvariant, defineRule, entryPoints, exitCodeOf, filesUnder, firstSentence, folderChanged, forgetTree, holdsDirectives, holdsManifest, ignoredPaths, isDirectory, isFile, isGroundFolder, isOnDisk, isProjectRoot, isRepositoryRoot, isReservedFolder, judgeExact, judgeFloor, keepsSection, labelOf, lessonOf, lessonParts, lessonsAt, listDirectory, markdownTable, missingParts, moveKeepingHistory, nearestRoot, presetChecks, projectFiles, projected, quotedMask, raisedFloor, readAt, readBaseline, readCommandLine, readFileCached, readManifest, readSettings, readSettingsSync, refusal, refusalBlock, reportLine, rowNamed, runChecker, sectionOf, spliceBetween, stop, suppressionDirectives, tightened, treeEntries, treeKind, treeNames, whyOf, workspaceMembers, workspacePatterns, writeProjections, writeSection
            the . entry's oxlint profiles are the oxlint entry's: yes
            the . entry's oxfmt is the oxfmt entry's base: yes
            the default export repeats both: yes
        `);
    });
});
