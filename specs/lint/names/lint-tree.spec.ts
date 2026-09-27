import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../names-lint.specification.js';

describe('lint-tree', () => {
    test('holds lint/ to its tree — index, consumer, self and engine, declarations apart, rules by family', async () => {
        // Given - the tree
        const result = await lint.fixture(directory('./_fixtures/lint-tree/')).run();

        // Then - each finding at its position, with its lesson
        expect(result.report).toMatch(`
            lint/README:1:1  names(lint-root-holds-only-index)
                found: \`lint/README\` sits at the root of lint/
                why: lint/ has one tree in every repository — its root holds \`index\`, the entry that composes consumer/ with engine/, and a folder names the audience of every other file
                fix: move it into the folder its audience names — consumer, engine, self — or into docs/ if it explains
                read: docs/06-quality-checks.md#the-lint-tree
            lint/catalog.js:1:1  names(lint-root-holds-only-index)
                found: \`lint/catalog.js\` sits at the root of lint/
                why: lint/ has one tree in every repository — its root holds \`index\`, the entry that composes consumer/ with engine/, and a folder names the audience of every other file
                fix: move it into the folder its audience names — consumer, engine, self — or into docs/ if it explains
                read: docs/06-quality-checks.md#the-lint-tree
            lint/consumer/checks/sweep.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/consumer/checks/sweep.js\` is a program — it reads the command line, ends the process or runs when executed
                why: consumer/ and self/ hold declarations alone, and the checker is what reads a command line, runs the declarations and says how the run ended; a program filed as a declaration is engine code no lock sees
                fix: move the program under engine/checker/ and hand it this declaration from an \`index\`, leaving here only what it judges
                read: docs/06-quality-checks.md#the-lint-tree
            lint/consumer/checks/tree.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/consumer/checks/tree.js\` hands \`listFiles\` to another module, named for no declaration of its file
                why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and what a declaration hands another module carries its file’s name, a value as a function, but for a catalogue row or what an \`index\` composes; one named for something else is code or data other files share, and that is the engine’s
                fix: move it under engine/ — project/, baseline/, checker/, catalogue/, compiler/, testing/ — or, when it is this declaration’s own, name it for the file
                read: docs/06-quality-checks.md#the-lint-tree
            lint/consumer/listing.js:1:1  names(consumer-folder-is-known)
                found: \`lint/consumer/listing.js\` holds a file at the root of consumer/
                why: consumer/ holds the declarations every consumer is held to — the catalogue, the rulebook of upstream decisions, our own rules by family, the checks, so its folders are catalogue, rulebook, rules, checks
                fix: move its files into the folder its nature names — catalogue/, rulebook/, rules/, checks/
                read: docs/06-quality-checks.md#the-lint-tree
            lint/consumer/rules/layout/no-sleep.js:1:1  names(rule-file-in-its-family-folder)
                found: \`lint/consumer/rules/layout/no-sleep.js\` sits under \`rules/layout/\`, and its catalogue row gives it the family \`chain\`
                why: a rule file sits under the folder of its family, so the tree and the catalogue say one thing
                fix: move it to \`rules/chain/\`, or correct the family its catalogue row declares
                read: docs/06-quality-checks.md#the-lint-tree
            lint/consumer/rules/no-sleep.js:1:1  names(rule-file-in-its-family-folder)
                found: \`lint/consumer/rules/no-sleep.js\` sits at the root of \`rules/\`, and its catalogue row gives it the family \`chain\`
                why: a rule file sits under the folder of its family, so the tree and the catalogue say one thing
                fix: move it to \`rules/chain/\`, or correct the family its catalogue row declares
                read: docs/06-quality-checks.md#the-lint-tree
            lint/consumer/scripts/:1:1  names(consumer-folder-is-known)
                found: \`lint/consumer/scripts/\` is not a folder of consumer/
                why: consumer/ holds the declarations every consumer is held to — the catalogue, the rulebook of upstream decisions, our own rules by family, the checks, so its folders are catalogue, rulebook, rules, checks
                fix: move its files into the folder its nature names — catalogue/, rulebook/, rules/, checks/
                read: docs/06-quality-checks.md#the-lint-tree
            lint/engine/ordering.js:1:1  names(engine-folder-is-known)
                found: \`lint/engine/ordering.js\` holds a file at the root of engine/
                why: engine/ holds what runs the declarations and knows none of them — how a project is read, the baseline, the checker, the catalogue rendered, the compiler of a rulebook into a config, the test tooling, so its folders are project, baseline, checker, catalogue, compiler, testing
                fix: move its files into the folder its nature names — project/, baseline/, checker/, catalogue/, compiler/, testing/
                read: docs/06-quality-checks.md#the-lint-tree
            lint/engine/reading/:1:1  names(engine-folder-is-known)
                found: \`lint/engine/reading/\` is not a folder of engine/
                why: engine/ holds what runs the declarations and knows none of them — how a project is read, the baseline, the checker, the catalogue rendered, the compiler of a rulebook into a config, the test tooling, so its folders are project, baseline, checker, catalogue, compiler, testing
                fix: move its files into the folder its nature names — project/, baseline/, checker/, catalogue/, compiler/, testing/
                read: docs/06-quality-checks.md#the-lint-tree
            lint/language/:1:1  names(lint-folder-is-known)
                found: \`lint/language/\` is not a folder of the lint tree
                why: lint/ has one tree in every repository, split by audience — consumer, engine, self
                fix: move its files where their audience puts them — a declaration every consumer is held to under consumer/, one only this repository is held to under self/, what runs them under engine/
                read: docs/06-quality-checks.md#the-lint-tree
            lint/self/checks/layers.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/self/checks/layers.js\` hands \`folderOf\` to another module, named for no declaration of its file
                why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and what a declaration hands another module carries its file’s name, a value as a function, but for a catalogue row or what an \`index\` composes; one named for something else is code or data other files share, and that is the engine’s
                fix: move it under engine/ — project/, baseline/, checker/, catalogue/, compiler/, testing/ — or, when it is this declaration’s own, name it for the file
                read: docs/06-quality-checks.md#the-lint-tree
            lint/self/corpus/walks.js:1:1  names(audience-holds-only-declarations)
                found: \`lint/self/corpus/walks.js\` hands \`FRAGMENT_WALK\` to another module, named for no declaration of its file
                why: consumer/ and self/ hold declarations alone — a rule, a check, a decision on an upstream rule, a catalogue entry, their tests — and what a declaration hands another module carries its file’s name, a value as a function, but for a catalogue row or what an \`index\` composes; one named for something else is code or data other files share, and that is the engine’s
                fix: move it under engine/ — project/, baseline/, checker/, catalogue/, compiler/, testing/ — or, when it is this declaration’s own, name it for the file
                read: docs/06-quality-checks.md#the-lint-tree
            lint/self/reading/:1:1  names(self-folder-is-known)
                found: \`lint/self/reading/\` is not a folder of self/
                why: self/ holds the declarations only this repository is held to — its catalogue, its rules by family, its checks, the meta-tests of its corpus, so its folders are catalogue, rules, checks, corpus, beside the \`index\` that composes them with engine/
                fix: move its files into the folder its nature names — catalogue/, rules/, checks/, corpus/
                read: docs/06-quality-checks.md#the-lint-tree
            lint/self/rules/imports/facet-is-a-composition.js:1:1  names(rule-file-in-its-family-folder)
                found: \`lint/self/rules/imports/facet-is-a-composition.js\` sits under \`rules/imports/\`, and its catalogue row gives it the family \`architecture\`
                why: a rule file sits under the folder of its family, so the tree and the catalogue say one thing
                fix: move it to \`rules/architecture/\`, or correct the family its catalogue row declares
                read: docs/06-quality-checks.md#the-lint-tree
            lint/self/test-coverage/:1:1  names(self-folder-is-known)
                found: \`lint/self/test-coverage/\` is not a folder of self/
                why: self/ holds the declarations only this repository is held to — its catalogue, its rules by family, its checks, the meta-tests of its corpus, so its folders are catalogue, rules, checks, corpus, beside the \`index\` that composes them with engine/
                fix: move its files into the folder its nature names — catalogue/, rules/, checks/, corpus/
                read: docs/06-quality-checks.md#the-lint-tree
            packages/tool/lint/scripts/:1:1  names(lint-folder-is-known)
                found: \`packages/tool/lint/scripts/\` is not a folder of the lint tree
                why: lint/ has one tree in every repository, split by audience — consumer, engine, self
                fix: move its files where their audience puts them — a declaration every consumer is held to under consumer/, one only this repository is held to under self/, what runs them under engine/
                read: docs/06-quality-checks.md#the-lint-tree
            skills/x/LICENSE:1:1  names(skill-holds-only-skill-md)
                found: \`skills/x/LICENSE\` sits beside a skill's \`SKILL.md\`
                why: a skill is one \`skills/<skill>/SKILL.md\`, the one page an agent loads, and a file beside it is one no agent reads
                fix: fold what it says into the \`SKILL.md\` or into the chapter the skill routes to, and delete it
                read: docs/06-quality-checks.md#the-names-tree-pass
            skills/x/SKILL.md.bak:1:1  names(skill-holds-only-skill-md)
                found: \`skills/x/SKILL.md.bak\` sits beside a skill's \`SKILL.md\`
                why: a skill is one \`skills/<skill>/SKILL.md\`, the one page an agent loads, and a file beside it is one no agent reads
                fix: fold what it says into the \`SKILL.md\` or into the chapter the skill routes to, and delete it
                read: docs/06-quality-checks.md#the-names-tree-pass
            skills/x/SKILL.txt:1:1  names(skill-holds-only-skill-md)
                found: \`skills/x/SKILL.txt\` sits beside a skill's \`SKILL.md\`
                why: a skill is one \`skills/<skill>/SKILL.md\`, the one page an agent loads, and a file beside it is one no agent reads
                fix: fold what it says into the \`SKILL.md\` or into the chapter the skill routes to, and delete it
                read: docs/06-quality-checks.md#the-names-tree-pass
        `);
    });
});
