#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, stdout } from 'node:process';

import { LABEL, readBaseline, reKey } from '../ratchet/baseline.js';
import { SOURCE } from '../reading/comments.js';
import { ignorePatternsOf, projectFiles, readText } from '../reading/project-files.js';
import { RENAMED_IDS } from './renamed-ids.js';

const READ = 'read: docs/06-quality-checks.md#a-renamed-id';

const DIRECTIVE = /(?:es|ox)lint-disable/u;

const escaped = (id) => id.replaceAll(/[.*+?^${}()|[\]\\/]/gu, String.raw`\$&`);

const OLD_ID = new RegExp(
    `(?<![\\w/-])(?:${Object.keys(RENAMED_IDS).map(escaped).join('|')})(?![\\w-])`,
    'gu',
);

function sourcesOf(root, ignorePatterns) {
    try {
        return projectFiles(root, { ignorePatterns }).filter((path) => SOURCE.test(path));
    } catch {
        return [];
    }
}

function directivesOf(root, ignorePatterns) {
    const cited = [];
    const rewrites = [];
    for (const path of sourcesOf(root, ignorePatterns)) {
        const text = readText(root, path);
        if (text === null || !DIRECTIVE.test(text)) {
            continue;
        }
        const before = cited.length;
        const rewritten = text
            .split('\n')
            .map((line, index) =>
                DIRECTIVE.test(line)
                    ? line.replaceAll(OLD_ID, (old) => {
                          cited.push({ line: index + 1, new: RENAMED_IDS[old], old, path });

                          return RENAMED_IDS[old];
                      })
                    : line,
            )
            .join('\n');
        if (cited.length > before) {
            rewrites.push({ path, text: rewritten });
        }
    }

    return { cited, rewrites };
}

function refusalOf(cited) {
    if (cited.line === undefined) {
        return `renamed-id  ${LABEL}  found: the entry \`${cited.old}\` keys an id this release renamed · why: an entry is judged by the id its pass prints, and nothing prints the old one any more · fix: run 'typescript fix' — it re-keys the entry to \`${cited.new}\` · ${READ}`;
    }

    return `renamed-id  ${cited.path}  found: line ${cited.line} disables \`${cited.old}\`, an id this release renamed · why: oxlint knows the rule by its new id alone, so the directive silences nothing · fix: run 'typescript fix' — it rewrites the directive to \`${cited.new}\` · ${READ}`;
}

if (import.meta.main) {
    const root = resolve(argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.');
    const ignorePatterns = ignorePatternsOf(argv);
    const { cited, rewrites } = directivesOf(root, ignorePatterns);

    if (argv.includes('--fix')) {
        for (const { path, text } of rewrites) {
            writeFileSync(join(root, path), text);
        }
        const moved = [...cited, ...reKey(root, RENAMED_IDS)];
        for (const { from, new: renamedTo, old, path, to } of moved) {
            stdout.write(`renamed  ${path ?? LABEL}  ${old ?? from} → ${renamedTo ?? to}\n`);
        }
        exit(0);
    }

    const keys = Object.keys(readBaseline(root) ?? {})
        .filter((rule) => Object.hasOwn(RENAMED_IDS, rule))
        .toSorted()
        .map((old) => ({ new: RENAMED_IDS[old], old }));
    const refusals = [...keys, ...cited].map((one) => refusalOf(one));
    for (const refusal of refusals) {
        stdout.write(`${refusal}\n`);
    }

    exit(refusals.length > 0 ? 1 : 0);
}
