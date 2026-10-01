import type { ChapterAnchor, Teaching } from '../../engine/catalogue/lesson.js';
import { defineCheck, rowNamed } from '../../engine/catalogue/rule.js';
import type { Finding } from '../../engine/checker/pass.js';
import FINDINGS from '../catalogue/findings.json' with { type: 'json' };

const CHAPTER = 'docs/06-quality-checks.md';

const READ_BY_FAMILY: Readonly<Record<string, ChapterAnchor>> = Object.freeze({
    names: `${CHAPTER}#the-names-tree-pass`,
    tree: `${CHAPTER}#the-repository-spine`,
});

const READ_BY_NAME: Readonly<Record<string, ChapterAnchor>> = Object.freeze({
    'declared-root-holds-files': `${CHAPTER}#a-root-beside-the-spine`,
    'declared-root-states-its-reason': `${CHAPTER}#a-root-beside-the-spine`,
    'entry-follows-its-grammar': `${CHAPTER}#the-entry-grammar`,
    'export-has-an-entry': `${CHAPTER}#the-entry-grammar`,
    'index-is-an-entry': `${CHAPTER}#the-entry-grammar`,
    'jterrazz-config-loads': 'docs/09-rules-kit.md#the-merge-order',
    'makefile-answers-every-gesture': `${CHAPTER}#the-six-gestures`,
    'no-empty-directory': `${CHAPTER}#an-empty-directory`,
    'no-undeclared-root-folder': `${CHAPTER}#a-root-beside-the-spine`,
    'repository-has-makefile': `${CHAPTER}#the-six-gestures`,
});

const NAMESPACE = 'names';

const ROWS: readonly { family: string; name: string; sentence: string; why: string | undefined }[] =
    FINDINGS.map((row) => ({
        family: row.family,
        name: row.id,
        sentence: row.sentence,
        why: 'why' in row ? row.why : undefined,
    }));

function checkOf(id: string): ReturnType<typeof defineCheck> {
    const { family, sentence, why } = rowNamed(ROWS, id);
    const name = id.slice(NAMESPACE.length + 1);

    return defineCheck({
        docs: { name, sentence, ...(why === undefined ? {} : { why }) },
        namespace: NAMESPACE,
        read: READ_BY_NAME[name] ?? READ_BY_FAMILY[family] ?? `${CHAPTER}#the-names-tree-pass`,
    });
}

export const namesFinding = (id: `names/${string}`, path: string, teaching: Teaching): Finding =>
    checkOf(id).finding({ column: 1, line: 1, path }, teaching);
