import type { PresetChecks } from './consumer/checks/preset-checks.js';
import { runChecker as runPasses } from './engine/checker/checker.js';
import type { Checker } from './engine/checker/pass.js';
import { readConfig, readConfigSync } from './engine/project/jterrazz-config.js';
import type { Resolution } from './engine/project/preset.js';
import { BASE_PRESETS } from './index.config.js';

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
} from './engine/catalogue/lesson.js';
export type {
    ChapterAnchor,
    InvariantOwner,
    Lesson,
    Taught,
    Teaching,
    Unread,
} from './engine/catalogue/lesson.js';
export {
    byName,
    defineCheck,
    defineRule,
    lessonsAt,
    readAt,
    rowNamed,
} from './engine/catalogue/rule.js';
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
} from './engine/catalogue/rule.js';
export { anchor, cell, markdownTable } from './engine/catalogue/table.js';
export {
    anchorsOf,
    projected,
    spliceBetween,
    writeProjections,
} from './engine/catalogue/chapter.js';
export type { Markers, Projection } from './engine/catalogue/chapter.js';
export { countsOf } from './engine/baseline/counts.js';
export { OXLINT_SUPPRESSIONS } from './engine/baseline/oxlint-suppressions.js';
export {
    BASELINE,
    keepsSection,
    labelOf,
    readBaseline,
    sectionOf,
    writeSection,
} from './engine/baseline/baseline-file.js';
export type { Counts, ReadBaseline, Sections } from './engine/baseline/baseline-file.js';
export { judgeExact, judgeFloor, raisedFloor, tightened } from './engine/baseline/section.js';
export type { Broken, Ratchet } from './engine/baseline/section.js';
export { readCommandLine } from './engine/checker/command-line.js';
export type { CommandLine } from './engine/checker/command-line.js';
export type {
    Checker,
    Commands,
    Context,
    EngineCommand,
    Finding,
    Held,
    HeldSection,
    Pass,
    Passes,
    PassResult,
} from './engine/checker/pass.js';
export { reportLine } from './engine/checker/report-line.js';
export { exitCodeOf, stop } from './engine/checker/stop.js';
export { holdsDirectives, suppressionDirectives } from './engine/project/directives.js';
export type { Directive, SuppressionDirectives } from './engine/project/directives.js';
export { entryPoints } from './engine/project/entry-points.js';
export {
    folderChanged,
    isDirectory,
    isFile,
    isOnDisk,
    listDirectory,
    readFileCached,
} from './engine/project/fs-cache.js';
export {
    forgetTree,
    moveKeepingHistory,
    treeEntries,
    treeKind,
    treeNames,
} from './engine/project/git-tree.js';
export type { TreeEntry } from './engine/project/git-tree.js';
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
} from './engine/project/ground.js';
export {
    declaredSubpaths,
    MEMBER_DEPTH,
    readManifest,
    workspacePatterns,
} from './engine/project/manifest.js';
export type { Manifest } from './engine/project/manifest.js';
export type { PresetLaw, Resolution, Resolved } from './engine/project/preset.js';
export type { PresetChecks } from './consumer/checks/preset-checks.js';
export { filesUnder, ignoredPaths, projectFiles, PRUNED } from './engine/project/project-files.js';
export {
    holdsManifest,
    isProjectRoot,
    isRepositoryRoot,
    nearestRoot,
} from './engine/project/repository-root.js';
export { blankComments, quotedMask } from './engine/project/comments.js';
export type { Span } from './engine/project/comments.js';
export { workspaceMembers } from './engine/project/workspace-members.js';

export const runChecker = async (
    checker: Omit<Checker, 'presets'>,
    args?: readonly string[],
): Promise<never> => await runPasses({ ...checker, presets: BASE_PRESETS }, args);

/** A unit's `jterrazz.config.ts`, resolved with the base preset first. */
export const readSettings = async (unit: string): Promise<Resolution> =>
    await readConfig(unit, BASE_PRESETS);

/** The same resolution, for a reader that runs synchronously, as an oxlint rule does. */
export const readSettingsSync = (unit: string): Resolution => readConfigSync(unit, BASE_PRESETS);

export async function presetChecks(root: string, config: object): Promise<PresetChecks> {
    const checks = await import('./consumer/checks/preset-checks.js');

    return await checks.presetChecks(root, { base: BASE_PRESETS, config });
}
