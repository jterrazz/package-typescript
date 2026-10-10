import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('lint-tree', () => {
    test('holds lint/ to its tree — index, consumer, self and kit, declarations apart, rules by family', async () => {
        // Given - a lint/ tree with files at its roots, a module at its root that is no entry, a program, a helper, and a rule filed under another family
        const result = await lint.fixture(directory('./__fixtures__/lint-tree/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/README:1:1  names(lint-root-holds-only-entries)
                found: \`lint/README\` sits at the root of lint/, and is no entry
                why: lint/ has one tree in every repository — its root holds the entries alone, each \`index[.<name>].ts\` built as a subpath the package publishes or a private import, where consumer/ meets kit/, and a folder names the audience of every other file
                fix: move it into the folder its audience names — consumer, kit, self — name it \`index.<name>.ts\` and declare it if it is an entry, or move it into docs/ if it explains
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/__tests__/Odd_Dir/:1:1  names(directory-in-kebab-case)
                found: \`lint/__tests__/Odd_Dir/\` is not written in kebab-case
                why: a directory name is part of every path and import that crosses it, and one case for every name reads the same on a disk that folds case and on one that does not
                fix: rename it in lowercase words joined by \`-\` — a \`__<word>__\` name is a special folder of the toolchain’s closed list, and a route segment keeps its framework grammar (\`[id]\`, \`(group)\`, \`@slot\`)
                read: docs/reference/quality-checks.md#the-names-tree-pass
            lint/catalog.json:1:1  names(lint-root-holds-only-entries)
                found: \`lint/catalog.json\` sits at the root of lint/, and is no entry
                why: lint/ has one tree in every repository — its root holds the entries alone, each \`index[.<name>].ts\` built as a subpath the package publishes or a private import, where consumer/ meets kit/, and a folder names the audience of every other file
                fix: move it into the folder its audience names — consumer, kit, self — name it \`index.<name>.ts\` and declare it if it is an entry, or move it into docs/ if it explains
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/compose.js:1:1  names(lint-root-holds-only-entries)
                found: \`lint/compose.js\` sits at the root of lint/, and is no entry
                why: lint/ has one tree in every repository — its root holds the entries alone, each \`index[.<name>].ts\` built as a subpath the package publishes or a private import, where consumer/ meets kit/, and a folder names the audience of every other file
                fix: move it into the folder its audience names — consumer, kit, self — name it \`index.<name>.ts\` and declare it if it is an entry, or move it into docs/ if it explains
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/consumer/checks/sweep.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/consumer/checks/sweep.js\` is a program — it reads the command line, ends the process or runs when executed
                why: consumer/ and self/ hold declarations alone, and the checker is what reads a command line, runs the declarations and says how the run ended; a program filed as a declaration is kit code no lock sees
                fix: move the program under kit/checker/ and hand it this declaration from a module at the root of lint/, leaving here only what it judges
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/consumer/checks/tree.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/consumer/checks/tree.js\` hands \`listFiles\` to another module, named for no declaration of its file
                why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and what a declaration hands another module carries its file’s name, a value as a function, but for a catalogue row or what a module at the root of lint/ composes; one named for something else is code or data other files share, and that is the kit’s
                fix: move it under kit/ — project/, baseline/, checker/, catalogue/, compiler/, testing/ — or, when it is this declaration’s own, name it for the file
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/consumer/listing.js:1:1  names(consumer-folder-is-known)
                found: \`lint/consumer/listing.js\` holds a file at the root of consumer/
                why: consumer/ holds the declarations every consumer is held to — the catalogue, the rulebook of upstream decisions, our own rules by family, the checks, so its folders are catalogue, rulebook, rules, checks
                fix: move its files into the folder its nature names — catalogue/, rulebook/, rules/, checks/
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/consumer/rules/layout/no-sleep.js:1:1  names(rule-file-in-its-family-folder)
                found: \`lint/consumer/rules/layout/no-sleep.js\` sits under \`rules/layout/\`, and its catalogue row gives it the family \`chain\`
                why: a rule file sits under the folder of its family, so the tree and the catalogue say one thing
                fix: move it to \`rules/chain/\`, or correct the family its catalogue row declares
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/consumer/rules/no-sleep.js:1:1  names(rule-file-in-its-family-folder)
                found: \`lint/consumer/rules/no-sleep.js\` sits at the root of \`rules/\`, and its catalogue row gives it the family \`chain\`
                why: a rule file sits under the folder of its family, so the tree and the catalogue say one thing
                fix: move it to \`rules/chain/\`, or correct the family its catalogue row declares
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/consumer/scripts/:1:1  names(consumer-folder-is-known)
                found: \`lint/consumer/scripts/\` is not a folder of consumer/
                why: consumer/ holds the declarations every consumer is held to — the catalogue, the rulebook of upstream decisions, our own rules by family, the checks, so its folders are catalogue, rulebook, rules, checks
                fix: move its files into the folder its nature names — catalogue/, rulebook/, rules/, checks/
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/kit/ordering.js:1:1  names(kit-folder-is-known)
                found: \`lint/kit/ordering.js\` holds a file at the root of kit/
                why: kit/ holds what runs the declarations and knows none of them — how a project is read, the baseline, the checker, the catalogue rendered, the compiler of a rulebook into a config, the test tooling, so its folders are project, baseline, checker, catalogue, compiler, testing
                fix: move its files into the folder its nature names — project/, baseline/, checker/, catalogue/, compiler/, testing/
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/kit/reading/:1:1  names(kit-folder-is-known)
                found: \`lint/kit/reading/\` is not a folder of kit/
                why: kit/ holds what runs the declarations and knows none of them — how a project is read, the baseline, the checker, the catalogue rendered, the compiler of a rulebook into a config, the test tooling, so its folders are project, baseline, checker, catalogue, compiler, testing
                fix: move its files into the folder its nature names — project/, baseline/, checker/, catalogue/, compiler/, testing/
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/language/:1:1  names(lint-folder-is-known)
                found: \`lint/language/\` is not a folder of the lint tree
                why: lint/ has one tree in every repository, split by audience — consumer, kit, self
                fix: move its files where their audience puts them — a declaration every consumer is held to under consumer/, one only this repository is held to under self/, what runs them under kit/
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/self/checks/depth-limit.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/self/checks/depth-limit.js\` hands \`DEPTH\` to another module, named for no declaration of its file
                why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and what a declaration hands another module carries its file’s name, a value as a function, but for a catalogue row or what a module at the root of lint/ composes; one named for something else is code or data other files share, and that is the kit’s
                fix: move it under kit/ — project/, baseline/, checker/, catalogue/, compiler/, testing/ — or, when it is this declaration’s own, name it for the file
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/self/checks/layers.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/self/checks/layers.js\` hands \`folderOf\` to another module, named for no declaration of its file
                why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and what a declaration hands another module carries its file’s name, a value as a function, but for a catalogue row or what a module at the root of lint/ composes; one named for something else is code or data other files share, and that is the kit’s
                fix: move it under kit/ — project/, baseline/, checker/, catalogue/, compiler/, testing/ — or, when it is this declaration’s own, name it for the file
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/self/corpus/walks.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/self/corpus/walks.js\` hands \`FRAGMENT_WALK\` to another module, named for no declaration of its file
                why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and what a declaration hands another module carries its file’s name, a value as a function, but for a catalogue row or what a module at the root of lint/ composes; one named for something else is code or data other files share, and that is the kit’s
                fix: move it under kit/ — project/, baseline/, checker/, catalogue/, compiler/, testing/ — or, when it is this declaration’s own, name it for the file
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/self/reading/:1:1  names(self-folder-is-known)
                found: \`lint/self/reading/\` is not a folder of self/
                why: self/ holds the declarations only this repository is held to — its catalogue, its rules by family, its checks, the meta-tests of its corpus, so its folders are catalogue, rules, checks, corpus, beside the modules that compose them with kit/
                fix: move its files into the folder its nature names — catalogue/, rules/, checks/, corpus/
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/self/rules/imports/specification-is-a-composition.js:1:1  names(rule-file-in-its-family-folder)
                found: \`lint/self/rules/imports/specification-is-a-composition.js\` sits under \`rules/imports/\`, and its catalogue row gives it the family \`architecture\`
                why: a rule file sits under the folder of its family, so the tree and the catalogue say one thing
                fix: move it to \`rules/architecture/\`, or correct the family its catalogue row declares
                read: docs/reference/quality-checks.md#the-lint-tree
            lint/self/test-coverage/:1:1  names(self-folder-is-known)
                found: \`lint/self/test-coverage/\` is not a folder of self/
                why: self/ holds the declarations only this repository is held to — its catalogue, its rules by family, its checks, the meta-tests of its corpus, so its folders are catalogue, rules, checks, corpus, beside the modules that compose them with kit/
                fix: move its files into the folder its nature names — catalogue/, rules/, checks/, corpus/
                read: docs/reference/quality-checks.md#the-lint-tree
            packages/tool/lint/scripts/:1:1  names(lint-folder-is-known)
                found: \`packages/tool/lint/scripts/\` is not a folder of the lint tree
                why: lint/ has one tree in every repository, split by audience — consumer, kit, self
                fix: move its files where their audience puts them — a declaration every consumer is held to under consumer/, one only this repository is held to under self/, what runs them under kit/
                read: docs/reference/quality-checks.md#the-lint-tree
            skills/x/LICENSE:1:1  names(skill-holds-only-skill-md)
                found: \`skills/x/LICENSE\` sits beside a skill's \`SKILL.md\`
                why: a skill is one \`skills/<skill>/SKILL.md\`, the page an agent loads, and the \`references/*.md\` pages it links for what a long skill discloses in steps; any other file beside it is one no agent reads
                fix: fold what it says into the \`SKILL.md\`, move a long part under \`references/<topic>.md\` and link it, or delete it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            skills/x/SKILL.md.bak:1:1  names(skill-holds-only-skill-md)
                found: \`skills/x/SKILL.md.bak\` sits beside a skill's \`SKILL.md\`
                why: a skill is one \`skills/<skill>/SKILL.md\`, the page an agent loads, and the \`references/*.md\` pages it links for what a long skill discloses in steps; any other file beside it is one no agent reads
                fix: fold what it says into the \`SKILL.md\`, move a long part under \`references/<topic>.md\` and link it, or delete it
                read: docs/reference/quality-checks.md#the-names-tree-pass
            skills/x/SKILL.txt:1:1  names(skill-holds-only-skill-md)
                found: \`skills/x/SKILL.txt\` sits beside a skill's \`SKILL.md\`
                why: a skill is one \`skills/<skill>/SKILL.md\`, the page an agent loads, and the \`references/*.md\` pages it links for what a long skill discloses in steps; any other file beside it is one no agent reads
                fix: fold what it says into the \`SKILL.md\`, move a long part under \`references/<topic>.md\` and link it, or delete it
                read: docs/reference/quality-checks.md#the-names-tree-pass
        `);
    });
});
