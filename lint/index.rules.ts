import type { PresetChecks } from './consumer/checks/preset-checks.js';
import { runChecker as runPasses } from './engine/checker/checker.js';
import type { Checker } from './engine/checker/pass.js';
import { readConfig, readConfigSync } from './engine/project/jterrazz-config.js';
import type { Config } from './engine/project/jterrazz-config.js';
import { BASE_PRESETS } from './index.config.js';

export {
    defineInvariant,
    firstSentence,
    LESSON_PARTS,
    LESSON_SEPARATOR,
    lessonOf,
    lessonParts,
    lessonsOf,
    messageOf,
    missingParts,
    refusal,
    refusalBlock,
    refusalReading,
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
    RuleDefinition,
    RuleDocs,
    RuleMeta,
    RuleOptions,
    RuleType,
} from './engine/catalogue/rule.js';
export { anchor, cell, markdownTable } from './engine/catalogue/table.js';
export {
    anchorsOf,
    generatedMarkers,
    projected,
    slugOf,
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
    withSection,
    writeSection,
} from './engine/baseline/baseline-file.js';
export type { Counts, ReadBaseline, Sections } from './engine/baseline/baseline-file.js';
export {
    judgeExact,
    judgeFloor,
    raisedFloor,
    reRecord,
    tightened,
} from './engine/baseline/section.js';
export type { Broken, Ratchet } from './engine/baseline/section.js';
export { heldSummary } from './engine/checker/held.js';
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
    resetFsCache,
} from './engine/project/fs-cache.js';
export {
    forgetTree,
    moveKeepingHistory,
    treeEntries,
    treeKind,
    treeNames,
    treeStamp,
} from './engine/project/git-tree.js';
export type { TreeEntry } from './engine/project/git-tree.js';
export {
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_FOLDERS,
    GROUND_GLOB,
    GROUND_GLOBS,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundFolder,
    isReservedFolder,
    RESERVED_FOLDERS,
    SETUP_FOLDER,
    SHARED_FOLDER,
    UNMARKED_RESERVED,
} from './engine/project/ground.js';
export { SETTINGS_FILE } from './engine/project/jterrazz-config.js';
export type { Config } from './engine/project/jterrazz-config.js';
export {
    declaredSubpaths,
    MEMBER_DEPTH,
    readManifest,
    workspacePatterns,
} from './engine/project/manifest.js';
export type { Manifest } from './engine/project/manifest.js';
export { definePreset, resolveConfig } from './engine/project/preset.js';
export { mergeSettings } from './engine/project/settings-merge.js';
export type { Merged } from './engine/project/settings-merge.js';
export type {
    ArchitectureRule,
    NamesRule,
    OptOut,
    Preset,
    Resolution,
    Resolved,
} from './engine/project/preset.js';
export type { PresetChecks } from './consumer/checks/preset-checks.js';
export {
    filesUnder,
    ignoredPaths,
    isGitIgnored,
    projectFiles,
    PRUNED,
} from './engine/project/project-files.js';
export { isRepositoryRoot } from './engine/project/repository-root.js';
export { workspaceMembers } from './engine/project/workspace-members.js';

export const runChecker = async (
    checker: Omit<Checker, 'presets'>,
    args?: readonly string[],
): Promise<never> => await runPasses({ ...checker, presets: BASE_PRESETS }, args);

/** A unit's `jterrazz.config.ts`, resolved with the base preset first. */
export const readSettings = async (unit: string): Promise<Config> =>
    await readConfig(unit, BASE_PRESETS);

/** The same resolution, for a reader that runs synchronously, as an oxlint rule does. */
export const readSettingsSync = (unit: string): Config => readConfigSync(unit, BASE_PRESETS);

export async function presetChecks(root: string, config: object): Promise<PresetChecks> {
    const checks = await import('./consumer/checks/preset-checks.js');

    return await checks.presetChecks(root, { base: BASE_PRESETS, config });
}
