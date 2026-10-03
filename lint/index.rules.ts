import { basePresetsOf } from './consumer/catalogue/preset.js';
import type { PresetChecks } from './consumer/checks/preset-checks.js';
import { runChecker as runPasses } from './kit/checker/checker.js';
import type { Checker } from './kit/checker/pass.js';
import { readConfig, readConfigSync } from './kit/project/jterrazz-config.js';
import type { Resolution } from './kit/project/preset.js';

export {
    defineInvariant,
    firstSentence,
    LESSON_PARTS,
    lessonOf,
    lessonParts,
    missingParts,
    refusal,
    refusalBlock,
    whyOf,
} from './kit/catalogue/lesson.js';
export type {
    ChapterAnchor,
    InvariantOwner,
    Lesson,
    Taught,
    Teaching,
    Unread,
} from './kit/catalogue/lesson.js';
export {
    byName,
    defineCheck,
    defineRule,
    lessonsAt,
    readAt,
    rowNamed,
} from './kit/catalogue/rule.js';
export type {
    Audience,
    Chapter,
    CheckDefinition,
    DefinedCheck,
    DefinedRule,
    Located,
    RuleBody,
    RuleDefinition,
    RuleDocs,
    RuleMeta,
    RuleOptions,
    RuleType,
} from './kit/catalogue/rule.js';
export { anchor, cell, markdownTable } from './kit/catalogue/table.js';
export { anchorsOf, projected, spliceBetween, writeProjections } from './kit/catalogue/chapter.js';
export type { Markers, Projection } from './kit/catalogue/chapter.js';
export { countsOf } from './kit/baseline/counts.js';
export { OXLINT_SUPPRESSIONS, SUPPRESSIONS_LEDGER } from './kit/baseline/oxlint-suppressions.js';
export {
    BASELINE,
    keepsSection,
    labelOf,
    readBaseline,
    sectionOf,
    writeSection,
} from './kit/baseline/baseline-file.js';
export type { Counts, ReadBaseline, Sections } from './kit/baseline/baseline-file.js';
export { judgeExact, judgeFloor, raisedFloor, tightened } from './kit/baseline/section.js';
export type { Broken, Ratchet } from './kit/baseline/section.js';
export { readCommandLine } from './kit/checker/command-line.js';
export type { CommandLine } from './kit/checker/command-line.js';
export type {
    Checker,
    Commands,
    Context,
    Contribution,
    Finding,
    Held,
    HeldSection,
    KitCommand,
    Pass,
    Passes,
    PassResult,
} from './kit/checker/pass.js';
export { reportLine } from './kit/checker/report-line.js';
export { exitCodeOf, stop } from './kit/checker/stop.js';
export { holdsDirectives, suppressionDirectives } from './kit/project/directives.js';
export type { Directive, SuppressionDirectives } from './kit/project/directives.js';
export { entryPoints } from './kit/project/entry-points.js';
export {
    folderChanged,
    isDirectory,
    isFile,
    isOnDisk,
    listDirectory,
    readFileCached,
} from './kit/project/fs-cache.js';
export {
    forgetTree,
    moveKeepingHistory,
    treeEntries,
    treeKind,
    treeNames,
} from './kit/project/git-tree.js';
export type { TreeEntry } from './kit/project/git-tree.js';
export {
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_FOLDERS,
    GROUND_GLOB,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundFolder,
    isReservedFolder,
    RESERVED_FOLDERS,
    SETUP_FOLDER,
    SHARED_FOLDER,
    UNMARKED_RESERVED,
} from './kit/project/ground.js';
export {
    declaredSubpaths,
    MEMBER_DEPTH,
    readManifest,
    workspacePatterns,
} from './kit/project/manifest.js';
export type { Manifest } from './kit/project/manifest.js';
export { OXLINT_CONFIG_NAMES } from './kit/project/oxlint-config-names.js';
export type { PresetLaw, Resolution, Resolved } from './kit/project/preset.js';
export type { PresetChecks } from './consumer/checks/preset-checks.js';
export { filesUnder, ignoredPaths, projectFiles, PRUNED } from './kit/project/project-files.js';
export {
    holdsManifest,
    isProjectRoot,
    isRepositoryRoot,
    nearestRoot,
} from './kit/project/repository-root.js';
export { blankComments, quotedMask } from './kit/project/comments.js';
export type { Span } from './kit/project/comments.js';
export { workspaceMembers } from './kit/project/workspace-members.js';

export const runChecker = async (
    checker: Omit<Checker, 'base'>,
    args?: readonly string[],
): Promise<never> => await runPasses({ ...checker, base: basePresetsOf }, args);

/** A unit's `jterrazz.config.ts`, resolved with the base preset first. */
export const readSettings = async (unit: string): Promise<Resolution> =>
    await readConfig(unit, basePresetsOf);

/** The same resolution, for a reader that runs synchronously, as an oxlint rule does. */
export const readSettingsSync = (unit: string): Resolution => readConfigSync(unit, basePresetsOf);

export async function presetChecks(root: string, config: object): Promise<PresetChecks> {
    const checks = await import('./consumer/checks/preset-checks.js');

    return await checks.presetChecks(root, { base: basePresetsOf, config });
}
